//! The match loop (events-engine.md §3.3) and the PostOnly cross walk (§3.4), one function in two modes so the
//! walk can never disagree with what matching would have done.
//!
//! Budgets per placement: `fills + self_cancels ≤ max_fills`, `evictions ≤ max_evictions`, `skips ≤ MAX_SKIPS`.
//! Levels are visited best price first while they cross the limit, nodes FIFO within a level. Every mutation is
//! plain bookkeeping on the Venue; a refusal returns `Err` and the transaction (on-chain) rolls everything back.

use super::evict::{remove_node, side_of};
use super::paths::{apply_maker, apply_taker, path_of};
use super::Venue;
use crate::book::{highest_at_or_below, lowest_at_or_above, node_at, release, shrink, side_parts, unlink, BookSide};
use crate::constants::{MAX_PRICE_TICKS, MAX_SKIPS, MIN_PRICE_TICKS, NIL_REF};
use crate::errors::EventsError;
use crate::events::{FillRecord, RemovedRecord};
use crate::state::{node_index, Kind, OrderNode, Path, RemoveReason, SelfMatch, StopReason};

#[derive(Clone, Copy, Debug)]
pub struct Taker {
    pub seat: u16,
    pub kind: Kind,
    pub limit: u16,
    pub lots: u64,
    pub self_match: SelfMatch,
    pub max_fills: u8,
    pub max_evictions: u8,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Walk {
    /// Fill crossing orders (Normal, IOC, FOK).
    Take,
    /// Never fill: evict or skip expired orders, refuse on any live crossing order (PostOnly).
    CrossCheck,
}

#[derive(Debug)]
pub struct MatchOutcome {
    pub filled_lots: u64,
    pub remaining: u64,
    pub cash_spent: u64,
    pub cash_received: u64,
    pub fills: u8,
    pub evictions: u8,
    pub self_cancels: u8,
    pub skips: u8,
    pub path_mask: u8,
    pub stop: StopReason,
    pub fill_records: Vec<FillRecord>,
    pub removed: Vec<RemovedRecord>,
}

fn crosses(taker_is_bid: bool, level_price: u16, limit: u16) -> bool {
    if taker_is_bid {
        level_price <= limit
    } else {
        level_price >= limit
    }
}

/// The next opposite-side level to visit after `from` (or the best one when `from` is `None`).
fn next_level(v: &Venue, taker_is_bid: bool, from: Option<u16>, limit: u16) -> Option<u16> {
    let p = if taker_is_bid {
        let start = match from {
            None => MIN_PRICE_TICKS,
            Some(p) if p >= MAX_PRICE_TICKS => return None,
            Some(p) => p + 1,
        };
        lowest_at_or_above(&v.book.ask_bits, start)?
    } else {
        let start = match from {
            None => MAX_PRICE_TICKS,
            Some(p) if p <= MIN_PRICE_TICKS => return None,
            Some(p) => p - 1,
        };
        highest_at_or_below(&v.book.bid_bits, start)?
    };
    crosses(taker_is_bid, p, limit).then_some(p)
}

pub fn run(v: &mut Venue, t: &Taker, walk: Walk) -> Result<MatchOutcome, EventsError> {
    let taker_is_bid = t.kind.is_bid();
    let opposite = if taker_is_bid { BookSide::Ask } else { BookSide::Bid };
    let mut out = MatchOutcome {
        filled_lots: 0,
        remaining: t.lots,
        cash_spent: 0,
        cash_received: 0,
        fills: 0,
        evictions: 0,
        self_cancels: 0,
        skips: 0,
        path_mask: 0,
        stop: StopReason::NoCross,
        fill_records: Vec::new(),
        removed: Vec::new(),
    };
    let mut level = next_level(v, taker_is_bid, None, t.limit);
    'levels: while let Some(price) = level {
        let mut r = side_parts(v.book, opposite).1[usize::from(price)].head;
        while r != NIL_REF {
            if out.remaining == 0 {
                out.stop = StopReason::Filled;
                break 'levels;
            }
            let node = *node_at(v.nodes, r)?;
            let next = node.next;
            if node.expire_ts <= v.now {
                if out.evictions < t.max_evictions {
                    out.removed.push(remove_node(v, r, RemoveReason::Expired)?);
                    out.evictions += 1;
                } else {
                    out.skips += 1;
                    if out.skips == MAX_SKIPS {
                        out.stop = StopReason::SkipCap;
                        break 'levels;
                    }
                }
                r = next;
                continue;
            }
            if walk == Walk::CrossCheck {
                return Err(EventsError::PostOnlyWouldCross);
            }
            if node.seat == t.seat {
                if t.self_match == SelfMatch::CancelTaker {
                    return Err(EventsError::SelfMatchCancelTaker);
                }
                if out.fills + out.self_cancels == t.max_fills {
                    out.stop = StopReason::FillCap;
                    break 'levels;
                }
                out.removed.push(remove_node(v, r, RemoveReason::SelfMatch)?);
                out.self_cancels += 1;
                r = next;
                continue;
            }
            if out.fills + out.self_cancels == t.max_fills {
                out.stop = StopReason::FillCap;
                break 'levels;
            }
            let q = out.remaining.min(node.lots);
            fill(v, t, &mut out, r, &node, price, q)?;
            r = next;
        }
        level = next_level(v, taker_is_bid, Some(price), t.limit);
    }
    if out.remaining == 0 {
        out.stop = StopReason::Filled;
    }
    Ok(out)
}

/// One fill of `q` lots against maker node `r` at the maker's price: both seats per §2.1, the node and level,
/// backing (MINT_PAIR +q, BURN_PAIR −q) and the Window's trade counters.
fn fill(v: &mut Venue, t: &Taker, out: &mut MatchOutcome, r: u32, node: &OrderNode, price: u16, q: u64) -> Result<(), EventsError> {
    let maker_kind = Kind::try_from(node.kind).map_err(|_| EventsError::UnknownOrder)?;
    let path = path_of(t.kind, maker_kind).ok_or(EventsError::UnknownOrder)?;
    let cu = v.cu;

    let maker = v.seats.get_mut(usize::from(node.seat)).ok_or(EventsError::SeatMismatch)?;
    apply_maker(maker, maker_kind, price, q, cu)?;
    let maker_owner = maker.owner;
    let maker_remaining = node.lots.checked_sub(q).ok_or(EventsError::MathOverflow)?;
    if maker_remaining == 0 {
        maker.open_orders = maker.open_orders.checked_sub(1).ok_or(EventsError::MathOverflow)?;
    }

    let taker = v.seats.get_mut(usize::from(t.seat)).ok_or(EventsError::SeatMismatch)?;
    let (pays, receives) = apply_taker(taker, t.kind, price, q, cu)?;
    out.cash_spent = out.cash_spent.checked_add(pays).ok_or(EventsError::MathOverflow)?;
    out.cash_received = out.cash_received.checked_add(receives).ok_or(EventsError::MathOverflow)?;

    let side = side_of(maker_kind);
    shrink(v.book, v.nodes, side, price, r, q)?;
    if maker_remaining == 0 {
        unlink(v.book, v.nodes, side, price, r)?;
        release(v.book, v.nodes, r)?;
        v.book.order_count = v.book.order_count.checked_sub(1).ok_or(EventsError::MathOverflow)?;
    }

    let m = &mut *v.market;
    m.backing_lots = match path {
        Path::MintPair => m.backing_lots.checked_add(q),
        Path::BurnPair => m.backing_lots.checked_sub(q),
        Path::DirectYes | Path::DirectNo => Some(m.backing_lots),
    }
    .ok_or(EventsError::MathOverflow)?;
    let notional = q.checked_mul(u64::from(price)).and_then(|x| x.checked_mul(cu)).ok_or(EventsError::MathOverflow)?;
    m.volume_lots = m.volume_lots.checked_add(q).ok_or(EventsError::MathOverflow)?;
    m.volume_cash = m.volume_cash.checked_add(notional).ok_or(EventsError::MathOverflow)?;
    m.trade_count = m.trade_count.checked_add(1).ok_or(EventsError::MathOverflow)?;
    m.last_price = price;
    m.last_trade_ts = v.now;

    out.filled_lots = out.filled_lots.checked_add(q).ok_or(EventsError::MathOverflow)?;
    out.remaining -= q;
    out.fills += 1;
    out.path_mask |= 1 << u8::from(path);
    out.fill_records.push(FillRecord {
        maker: maker_owner,
        maker_seat: node.seat,
        maker_node: node_index(r).and_then(|i| u32::try_from(i).ok()).ok_or(EventsError::UnknownOrder)?,
        maker_seq: node.seq,
        maker_kind: node.kind,
        path: u8::from(path),
        price,
        lots: q,
        maker_remaining,
    });
    Ok(())
}
