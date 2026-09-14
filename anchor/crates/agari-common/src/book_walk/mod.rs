//! Book walks (events-engine.md §9): read-only views over a checked Book that every product and the TS mirror
//! (`packages/core/src/market/book-math.ts`) share, with vectors in `anchor/tests/vectors/book.vectors.json`.
//!
//! Walks **traverse FIFO nodes**, never `Level.live_lots` alone (that still counts unevicted expired orders), and
//! apply the node filter: live, `expire_ts > now`, and, for reserve pricing and knock-outs (PD-2), rested at least
//! `min_rest_slots`. This crate does not depend on the engine: the engine's zero-copy `Level`/`OrderNode`
//! implement the two small traits below, so products that already hold engine types (via the `cpi` crate) walk
//! them without copying.

mod depth;

pub use depth::{exit_walk, quote_stake, vwap_over_depth, BuySide, StakeQuote, DEFAULT_SLIPPAGE_BPS, DEFAULT_SLIPPAGE_MIN_TICKS};

use crate::grid::{MAX_PRICE_TICKS, MIN_PRICE_TICKS, PAIR_TICKS};

/// A price level: the 1-based ref of its oldest node (0 = empty).
pub trait WalkLevel {
    fn head(&self) -> u32;
}

/// A resting order node as a walk reads it.
pub trait WalkNode {
    fn lots(&self) -> u64;
    fn expire_ts(&self) -> i64;
    fn placed_slot(&self) -> u64;
    fn is_live(&self) -> bool;
    /// 1-based ref of the next (newer) node at the same price; 0 = end.
    fn next(&self) -> u32;
}

/// One side of a Book: its bitmap (bit `p` set iff level `p` has a node), levels indexed by price, and the nodes.
#[derive(Clone, Copy)]
pub struct BookSide<'a, L, N> {
    pub bits: &'a [u64; 16],
    pub levels: &'a [L],
    pub nodes: &'a [N],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Bid,
    Ask,
}

/// Which nodes count (events-engine.md §9 "Node filter").
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct NodeFilter {
    pub now: i64,
    pub slot: u64,
    /// Count only orders rested ≥ `min_rest_slots` (reserve pricing, knock-outs; PD-2).
    pub rested_only: bool,
    pub min_rest_slots: u64,
}

impl NodeFilter {
    pub fn admits<N: WalkNode>(&self, node: &N) -> bool {
        node.is_live() && node.expire_ts() > self.now && (!self.rested_only || node.placed_slot().saturating_add(self.min_rest_slots) <= self.slot)
    }
}

/// A taker's view of the book, in its own outcome's terms (SDK `levelsToCross`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TakerKind {
    BuyYes,
    SellYes,
    BuyNo,
    SellNo,
}

/// `(price_ticks, lots)`, best first.
pub type Level = (u16, u64);

/// Filtered lots resting at one price, walking its FIFO list. A corrupt ref or a cycle ends the walk (at most
/// `nodes.len()` steps), so a malformed Book can undercount but never loop or read out of bounds.
fn level_lots<L: WalkLevel, N: WalkNode>(book: &BookSide<'_, L, N>, price: u16, filter: &NodeFilter) -> u64 {
    let Some(level) = book.levels.get(usize::from(price)) else { return 0 };
    let mut total = 0u64;
    let mut r = level.head();
    for _ in 0..book.nodes.len() {
        let Some(node) = r.checked_sub(1).and_then(|i| book.nodes.get(i as usize)) else { break };
        if filter.admits(node) {
            total = total.saturating_add(node.lots());
        }
        r = node.next();
    }
    total
}

/// Up to `n` non-empty filtered levels, best first: bids descending, asks ascending (via the bitmap). Levels whose
/// filtered total is 0 are omitted.
pub fn levels<L: WalkLevel, N: WalkNode>(book: &BookSide<'_, L, N>, side: Side, n: usize, filter: &NodeFilter) -> Vec<Level> {
    let mut out = Vec::with_capacity(n.min(32));
    if n == 0 {
        return out;
    }
    // Jump between set bits (lowest first for asks, highest first for bids) instead of scanning 999 prices.
    let words: &mut dyn Iterator<Item = usize> = match side {
        Side::Bid => &mut (0..16).rev(),
        Side::Ask => &mut (0..16),
    };
    for w in words {
        let mut word = book.bits[w];
        while word != 0 {
            let b = match side {
                Side::Bid => 63 - word.leading_zeros(),
                Side::Ask => word.trailing_zeros(),
            };
            word &= !(1u64 << b);
            let price = (w * 64) as u16 + b as u16;
            if !(MIN_PRICE_TICKS..=MAX_PRICE_TICKS).contains(&price) {
                continue;
            }
            let lots = level_lots(book, price, filter);
            if lots > 0 {
                out.push((price, lots));
                if out.len() == n {
                    return out;
                }
            }
        }
    }
    out
}

/// Best filtered bid and ask.
pub fn top_of_book<L: WalkLevel, N: WalkNode>(bids: &BookSide<'_, L, N>, asks: &BookSide<'_, L, N>, filter: &NodeFilter) -> (Option<Level>, Option<Level>) {
    (levels(bids, Side::Bid, 1, filter).first().copied(), levels(asks, Side::Ask, 1, filter).first().copied())
}

/// The levels a taker crosses, in its outcome's own price terms, best first: BUY_YES takes asks as-is, SELL_YES hits
/// bids as-is, BUY_NO takes bids inverted (`1000 − p`, highest bid = cheapest NO), SELL_NO hits asks inverted.
pub fn outcome_levels<L: WalkLevel, N: WalkNode>(
    kind: TakerKind,
    bids: &BookSide<'_, L, N>,
    asks: &BookSide<'_, L, N>,
    n: usize,
    filter: &NodeFilter,
) -> Vec<Level> {
    let invert = |ls: Vec<Level>| ls.into_iter().map(|(p, q)| ((PAIR_TICKS as u16) - p, q)).collect();
    match kind {
        TakerKind::BuyYes => levels(asks, Side::Ask, n, filter),
        TakerKind::SellYes => levels(bids, Side::Bid, n, filter),
        TakerKind::BuyNo => invert(levels(bids, Side::Bid, n, filter)),
        TakerKind::SellNo => invert(levels(asks, Side::Ask, n, filter)),
    }
}

#[cfg(test)]
mod tests;
