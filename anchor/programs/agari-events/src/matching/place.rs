//! `user_place_order` as pure bookkeeping (events-instructions.md §3.1 steps 1 and 3–13; events-engine.md §3–§4).
//! The handler adds the account bindings, performs the two token transfers this computes and emits the event.

use agari_common::grid::is_valid_price;
use agari_common::place_result::{Handle, PlaceResult};
use anchor_lang::prelude::Pubkey;

use super::engine::{run, Taker, Walk};
use super::evict::side_of;
use super::paths::{cash_of, lock_escrow};
use super::seats::{bond_for, fund, resolve_seat, sweep_credit};
use super::Venue;
use crate::book::{alloc, node_at_mut, push_back};
use crate::constants::{MAX_EVICTIONS_CAP, MAX_FILLS_CAP, MAX_OPEN_ORDERS_PER_SEAT};
use crate::errors::EventsError;
use crate::events::{FillRecord, RemovedRecord};
use crate::instructions::PlaceOrderArgs;
use crate::state::{node_index, Kind, Market, MarketStatus, Mode, OrderType, SelfMatch, StopReason, NODE_FLAG_LIVE};

/// The Series parameters a placement reads.
#[derive(Clone, Copy, Debug)]
pub struct SeriesRules {
    pub min_lots: u64,
    pub fills_cap: u8,
    pub evictions_cap: u8,
}

#[derive(Clone, Copy, Debug)]
pub struct ValidOrder {
    pub kind: Kind,
    pub order_type: OrderType,
    pub self_match: SelfMatch,
    pub price: u16,
    pub lots: u64,
    pub expire_ts: i64,
    pub max_fills: u8,
    pub max_evictions: u8,
    pub seat_hint: u16,
    pub use_credit: bool,
    pub withdraw_proceeds: bool,
}

pub struct Placement {
    pub result: PlaceResult,
    pub fills: Vec<FillRecord>,
    pub removed: Vec<RemovedRecord>,
}

/// Step 1: Halted refuses every placement; ReduceOnly refuses buys.
pub fn check_mode(mode: u8, kind: u8) -> Result<(), EventsError> {
    match Mode::try_from(mode) {
        Ok(Mode::Normal) => Ok(()),
        Ok(Mode::ReduceOnly) if !Kind::try_from(kind).is_ok_and(Kind::is_buy) => Ok(()),
        _ => Err(EventsError::InvalidMode),
    }
}

/// Steps 3–7, in order.
pub fn check_order(market: &Market, now: i64, a: &PlaceOrderArgs, rules: SeriesRules) -> Result<ValidOrder, EventsError> {
    let bad = EventsError::InvalidOrderArgs;
    let kind = Kind::try_from(a.kind).map_err(|_| bad)?;
    let order_type = OrderType::try_from(a.order_type).map_err(|_| bad)?;
    // D-088 "trade in advance": a Listed Window rests PostOnly quotes before its open print, so a book exists at T.
    // Nothing may take there: without an open print no fill could be priced against the Window's own strike.
    match market.status(now) {
        MarketStatus::Trading => {}
        MarketStatus::Listed if order_type == OrderType::PostOnly => {}
        MarketStatus::Listed => return Err(EventsError::PreOpenTakerRefused),
        _ => return Err(EventsError::MarketNotTrading),
    }
    let self_match = SelfMatch::try_from(a.self_match).map_err(|_| bad)?;
    if a.max_fills == 0 || a.max_fills > MAX_FILLS_CAP.min(rules.fills_cap) || a.max_evictions > MAX_EVICTIONS_CAP.min(rules.evictions_cap) {
        return Err(bad);
    }
    if !is_valid_price(a.price_ticks) {
        return Err(EventsError::InvalidPrice);
    }
    if a.lots == 0 {
        return Err(EventsError::InvalidQuantity);
    }
    if a.lots < rules.min_lots {
        return Err(EventsError::BelowMinLots);
    }
    if a.expire_ts <= now {
        return Err(EventsError::OrderAlreadyExpired);
    }
    if a.expire_ts > market.lock_at {
        return Err(EventsError::ExpiryAfterLock);
    }
    Ok(ValidOrder {
        kind,
        order_type,
        self_match,
        price: a.price_ticks,
        lots: a.lots,
        expire_ts: a.expire_ts,
        max_fills: a.max_fills,
        max_evictions: a.max_evictions,
        seat_hint: a.seat_hint,
        use_credit: a.use_credit,
        withdraw_proceeds: a.withdraw_proceeds,
    })
}

/// Steps 8–13: seat, sell balance, PostOnly walk or match, remainder, funding, proceeds.
pub fn place(v: &mut Venue, authority: &Pubkey, o: &ValidOrder) -> Result<Placement, EventsError> {
    let seat_use = resolve_seat(v.ledger, v.seats, authority, o.seat_hint)?;
    let si = usize::from(seat_use.index);
    let free = match o.kind {
        Kind::SellYes => Some(v.seats[si].yes_free),
        Kind::SellNo => Some(v.seats[si].no_free),
        Kind::BuyYes | Kind::BuyNo => None,
    };
    if free.is_some_and(|f| f < o.lots) {
        return Err(EventsError::InsufficientOutcome);
    }

    let taker = Taker { seat: seat_use.index, kind: o.kind, limit: o.price, lots: o.lots, self_match: o.self_match, max_fills: o.max_fills, max_evictions: o.max_evictions };
    let outcome = if o.order_type == OrderType::PostOnly {
        if v.seats[si].open_orders >= MAX_OPEN_ORDERS_PER_SEAT {
            return Err(EventsError::TooManyOpenOrders);
        }
        let walk = run(v, &taker, Walk::CrossCheck)?;
        if walk.stop == StopReason::SkipCap {
            return Err(EventsError::PostOnlyWouldCross);
        }
        walk
    } else {
        run(v, &taker, Walk::Take)?
    };

    let rest = match o.order_type {
        OrderType::Fok if outcome.remaining != 0 => return Err(EventsError::FillOrKillNotFillable),
        OrderType::Ioc if outcome.filled_lots == 0 => return Err(EventsError::ImmediateOrCancelNoFill),
        OrderType::Fok | OrderType::Ioc => false,
        OrderType::Normal => outcome.remaining > 0 && matches!(outcome.stop, StopReason::NoCross | StopReason::Filled),
        OrderType::PostOnly => outcome.remaining > 0,
    };
    let (rested, rested_lots) = if rest { (rest_order(v, seat_use.index, o, outcome.remaining)?, outcome.remaining) } else { (Handle::NONE, 0) };

    let bond = bond_for(v.ledger, seat_use);
    let rest_escrow = if o.kind.is_buy() { cash_of(o.kind, o.price, rested_lots, v.cu)? } else { 0 };
    let need = outcome.cash_spent.checked_add(rest_escrow).and_then(|x| x.checked_add(bond)).ok_or(EventsError::MathOverflow)?;
    let seat = &mut v.seats[si];
    seat.credit = seat.credit.checked_add(outcome.cash_received).ok_or(EventsError::MathOverflow)?;
    let funding = fund(seat, need, o.use_credit);
    let withdrawn = sweep_credit(seat, o.withdraw_proceeds);

    let refunded = if o.kind.is_buy() {
        cash_of(o.kind, o.price, o.lots, v.cu)?.checked_sub(outcome.cash_spent).and_then(|x| x.checked_sub(rest_escrow)).ok_or(EventsError::MathOverflow)?
    } else {
        0
    };
    let stop = if o.order_type == OrderType::PostOnly && rest { StopReason::PostOnlyRested } else { outcome.stop };
    let result = PlaceResult {
        filled_lots: outcome.filled_lots,
        cash_spent: outcome.cash_spent,
        cash_received: outcome.cash_received,
        credit_used: funding.credit_used,
        transferred_in: funding.transferred_in,
        withdrawn,
        refunded,
        rested_lots,
        cancelled_lots: o.lots - outcome.filled_lots - rested_lots,
        rested,
        seat: seat_use.index,
        fills: outcome.fills,
        evictions: outcome.evictions,
        self_cancels: outcome.self_cancels,
        stop_reason: u8::from(stop),
        path_mask: outcome.path_mask,
    };
    Ok(Placement { result, fills: outcome.fill_records, removed: outcome.removed })
}

/// Rests `lots` at the tail of the order's price level, locking its escrow (step 12).
fn rest_order(v: &mut Venue, seat: u16, o: &ValidOrder, lots: u64) -> Result<Handle, EventsError> {
    let si = usize::from(seat);
    if v.seats[si].open_orders >= MAX_OPEN_ORDERS_PER_SEAT {
        return Err(EventsError::TooManyOpenOrders);
    }
    let r = alloc(v.book, v.nodes)?;
    let seq = v.book.next_seq;
    v.book.next_seq = seq.checked_add(1).ok_or(EventsError::MathOverflow)?;
    let node = node_at_mut(v.nodes, r)?;
    node.lots = lots;
    node.seq = seq;
    node.expire_ts = o.expire_ts;
    node.placed_slot = v.slot;
    node.price = o.price;
    node.seat = seat;
    node.kind = u8::from(o.kind);
    node.flags = NODE_FLAG_LIVE;
    push_back(v.book, v.nodes, side_of(o.kind), o.price, r)?;
    v.book.order_count = v.book.order_count.checked_add(1).ok_or(EventsError::MathOverflow)?;
    let seat_ref = &mut v.seats[si];
    seat_ref.open_orders += 1;
    lock_escrow(seat_ref, o.kind, o.price, lots, v.cu)?;
    let index = node_index(r).and_then(|i| u32::try_from(i).ok()).ok_or(EventsError::UnknownOrder)?;
    Ok(Handle { node: index, seq })
}
