//! The matching and ledger core (events-engine.md §2–§8.1) as pure functions over plain references: no Anchor
//! account types, no token I/O. Instruction handlers bind accounts, call these, then move tokens with the amounts
//! returned; the native randomized harness drives exactly the same code.

pub mod engine;
pub mod evict;
pub mod orders;
pub mod paths;
pub mod place;
pub mod redeem;
pub mod seats;
pub mod sets;

#[cfg(test)]
mod tests;

use crate::state::{Book, Ledger, Market, OrderNode, Seat};

/// One Window's mutable trading state for the duration of an instruction.
pub struct Venue<'a> {
    pub book: &'a mut Book,
    pub nodes: &'a mut [OrderNode],
    pub ledger: &'a mut Ledger,
    pub seats: &'a mut [Seat],
    pub market: &'a mut Market,
    /// `Series.cash_unit`.
    pub cu: u64,
    pub now: i64,
    pub slot: u64,
}
