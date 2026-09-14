//! The engine's zero-copy Book as `agari_common::book_walk` input (events-engine.md §9), so products and views walk
//! the real nodes with the same code the TS mirror and shared vectors test.

use agari_common::book_walk::{BookSide as WalkSide, WalkLevel, WalkNode};

use crate::state::{Book, Level, OrderNode, NODE_FLAG_LIVE};

impl WalkLevel for Level {
    fn head(&self) -> u32 {
        self.head
    }
}

impl WalkNode for OrderNode {
    fn lots(&self) -> u64 {
        self.lots
    }
    fn expire_ts(&self) -> i64 {
        self.expire_ts
    }
    fn placed_slot(&self) -> u64 {
        self.placed_slot
    }
    fn is_live(&self) -> bool {
        self.flags & NODE_FLAG_LIVE != 0
    }
    fn next(&self) -> u32 {
        self.next
    }
}

/// The bid side of a Book for the walks.
pub fn walk_bids<'a>(book: &'a Book, nodes: &'a [OrderNode]) -> WalkSide<'a, Level, OrderNode> {
    WalkSide { bits: &book.bid_bits, levels: &book.bids, nodes }
}

/// The ask side of a Book for the walks.
pub fn walk_asks<'a>(book: &'a Book, nodes: &'a [OrderNode]) -> WalkSide<'a, Level, OrderNode> {
    WalkSide { bits: &book.ask_bits, levels: &book.asks, nodes }
}
