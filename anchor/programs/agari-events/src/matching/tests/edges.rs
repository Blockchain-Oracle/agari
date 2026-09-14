//! Order types and the edges of the match loop (events-engine.md §3–§6). Every refusal leaves the venue exactly as
//! it was (the helper restores the snapshot, as a revert does) and every success keeps the §8.3 invariants.

use super::support::*;
use crate::errors::EventsError;
use crate::events::OrderHandle;
use crate::matching::orders::{cancel_handles, reduce_order};
use crate::state::{Kind, StopReason};

#[test]
fn ioc_with_no_fill_refuses_even_after_evicting() {
    let mut t = TestVenue::new(64, 8, 0);
    t.place(1, order(Kind::BuyNo, 500, 100, NORMAL).expires(START + 5)).unwrap();
    t.now = START + 5;
    let before = t.book.order_count;
    assert_eq!(t.place(2, order(Kind::BuyYes, 600, 100, IOC)).unwrap_err() as u32, EventsError::ImmediateOrCancelNoFill as u32);
    assert_eq!(t.book.order_count, before, "the eviction is undone with the refusal");
    t.check().unwrap();
}

#[test]
fn fok_refuses_a_partial_fill_and_accepts_a_full_one() {
    let mut t = TestVenue::new(64, 8, 0);
    t.place(1, order(Kind::BuyNo, 500, 100, NORMAL)).unwrap();
    assert_eq!(t.place(2, order(Kind::BuyYes, 500, 150, FOK)).unwrap_err() as u32, EventsError::FillOrKillNotFillable as u32);
    let r = t.place(2, order(Kind::BuyYes, 500, 100, FOK)).unwrap();
    assert_eq!((r.filled_lots, r.rested_lots), (100, 0));
    t.check().unwrap();
}

#[test]
fn post_only_refuses_any_live_crossing_order_including_its_own() {
    let mut t = TestVenue::new(64, 8, 0);
    t.place(1, order(Kind::BuyNo, 500, 100, NORMAL)).unwrap();
    assert_eq!(t.place(2, order(Kind::BuyYes, 500, 100, POST_ONLY)).unwrap_err() as u32, EventsError::PostOnlyWouldCross as u32);
    assert_eq!(t.place(1, order(Kind::BuyYes, 510, 100, POST_ONLY)).unwrap_err() as u32, EventsError::PostOnlyWouldCross as u32);
    let r = t.place(2, order(Kind::BuyYes, 499, 100, POST_ONLY)).unwrap();
    assert_eq!(r.stop_reason, StopReason::PostOnlyRested as u8);
    t.check().unwrap();
}

#[test]
fn self_match_cancel_taker_refuses_and_cancel_maker_cancels_and_continues() {
    let mut t = TestVenue::new(64, 8, 0);
    t.place(1, order(Kind::BuyNo, 550, 1_000, NORMAL)).unwrap();
    t.place(2, order(Kind::BuyNo, 560, 1_000, NORMAL)).unwrap();
    assert_eq!(t.place(1, order(Kind::BuyYes, 600, 2_000, IOC)).unwrap_err() as u32, EventsError::SelfMatchCancelTaker as u32);
    let r = t.place(1, order(Kind::BuyYes, 600, 2_000, IOC).cancel_maker()).unwrap();
    assert_eq!((r.self_cancels, r.fills, r.filled_lots, r.cash_spent), (1, 1, 1_000, 560_000));
    assert_eq!(t.seat(1).credit, 1_000 * 450, "the cancelled ask's escrow came back");
    t.check().unwrap();
}

#[test]
fn a_self_cancel_spends_the_fill_budget() {
    let mut t = TestVenue::new(64, 8, 0);
    t.place(1, order(Kind::BuyNo, 550, 1_000, NORMAL)).unwrap();
    t.place(2, order(Kind::BuyNo, 560, 1_000, NORMAL)).unwrap();
    let r = t.place(1, order(Kind::BuyYes, 600, 2_000, NORMAL).cancel_maker().caps(1, 16)).unwrap();
    assert_eq!((r.self_cancels, r.fills, r.stop_reason, r.rested_lots, r.cancelled_lots), (1, 0, StopReason::FillCap as u8, 0, 2_000));
    t.check().unwrap();
}

#[test]
fn skip_cap_stops_matching_and_cancels_the_remainder() {
    let mut t = TestVenue::new(256, 16, 0);
    for owner in 10..14u8 {
        for _ in 0..16 {
            t.place(owner, order(Kind::BuyNo, 500, 1, NORMAL).expires(START + 5)).unwrap();
        }
    }
    t.place(20, order(Kind::BuyNo, 500, 100, NORMAL)).unwrap();
    t.now = START + 5;
    let r = t.place(2, order(Kind::BuyYes, 600, 100, NORMAL).caps(16, 0)).unwrap();
    assert_eq!((r.stop_reason, r.filled_lots, r.rested_lots, r.cancelled_lots), (StopReason::SkipCap as u8, 0, 0, 100));
    assert_eq!(t.place(2, order(Kind::BuyYes, 400, 100, POST_ONLY).caps(16, 0)).map(|r| r.rested_lots).ok(), Some(100), "a non-crossing PostOnly still rests");
    assert_eq!(t.place(3, order(Kind::BuyYes, 600, 100, POST_ONLY).caps(16, 0)).unwrap_err() as u32, EventsError::PostOnlyWouldCross as u32);
    t.check().unwrap();
}

#[test]
fn open_order_book_and_ledger_limits_refuse_by_name() {
    let mut t = TestVenue::new(20, 2, 0);
    for i in 0..16 {
        t.place(1, order(Kind::BuyYes, 100 + i, 1, NORMAL)).unwrap();
    }
    assert_eq!(t.place(1, order(Kind::BuyYes, 200, 1, NORMAL)).unwrap_err() as u32, EventsError::TooManyOpenOrders as u32);
    assert_eq!(t.place(1, order(Kind::BuyYes, 200, 1, POST_ONLY)).unwrap_err() as u32, EventsError::TooManyOpenOrders as u32);
    for i in 0..4 {
        t.place(2, order(Kind::BuyYes, 300 + i, 1, NORMAL)).unwrap();
    }
    assert_eq!(t.place(2, order(Kind::BuyYes, 310, 1, NORMAL)).unwrap_err() as u32, EventsError::BookFull as u32);
    assert_eq!(t.place(3, order(Kind::BuyYes, 310, 1, NORMAL)).unwrap_err() as u32, EventsError::LedgerFull as u32);
    t.check().unwrap();
}

#[test]
fn seat_hints_are_verified() {
    let mut t = TestVenue::new(20, 4, 250_000);
    t.place(1, order(Kind::BuyYes, 100, 1, NORMAL)).unwrap();
    let first = t.seat_of(1).unwrap();
    assert_eq!(t.place(2, order(Kind::BuyYes, 100, 1, NORMAL).hint(first)).unwrap_err() as u32, EventsError::SeatMismatch as u32, "someone else's seat");
    assert_eq!(t.place(1, order(Kind::BuyYes, 100, 1, NORMAL).hint(3)).unwrap_err() as u32, EventsError::SeatMismatch as u32, "a second seat for one owner");
    assert_eq!(t.place(1, order(Kind::BuyYes, 100, 1, NORMAL).hint(u16::MAX)).unwrap_err() as u32, EventsError::SeatMismatch as u32);
    assert_eq!(t.place(2, order(Kind::BuyYes, 100, 1, NORMAL).hint(4)).unwrap_err() as u32, EventsError::SeatMismatch as u32, "past capacity");
    let r = t.place(2, order(Kind::BuyYes, 100, 1, NORMAL).hint(2)).unwrap();
    assert_eq!((r.seat, r.transferred_in), (2, 100 + 250_000), "a claim posts the bond");
    t.check().unwrap();
}

#[test]
fn stale_handles_are_skipped_even_after_their_node_is_reused() {
    let mut t = TestVenue::new(20, 4, 0);
    let r = t.place(1, order(Kind::BuyNo, 500, 100, NORMAL)).unwrap();
    let old = OrderHandle { node: r.rested.node, seq: r.rested.seq };
    t.place(2, order(Kind::BuyYes, 500, 100, IOC)).unwrap();
    let again = t.place(1, order(Kind::BuyNo, 500, 100, NORMAL)).unwrap();
    assert_eq!(again.rested.node, old.node, "the freed node is reused");
    let seat = t.seat_of(1).unwrap();
    let (removed, skipped) = cancel_handles(&mut t.venue(), seat, &[old]).unwrap();
    assert_eq!((removed.len(), skipped), (0, 1));
    let fresh = OrderHandle { node: again.rested.node, seq: again.rested.seq };
    let other = t.seat_of(2).unwrap();
    assert_eq!(cancel_handles(&mut t.venue(), other, &[fresh]).unwrap_err() as u32, EventsError::NotOrderOwner as u32);
    t.check().unwrap();
}

#[test]
fn reduce_keeps_queue_priority() {
    let mut t = TestVenue::new(20, 4, 0);
    t.seed_pair(1, 9, 1_000);
    t.seed_pair(2, 9, 1_000);
    let a = t.place(1, order(Kind::SellYes, 500, 1_000, NORMAL)).unwrap();
    t.place(2, order(Kind::SellYes, 500, 1_000, NORMAL)).unwrap();
    let seat = t.seat_of(1).unwrap();
    let handle = OrderHandle { node: a.rested.node, seq: a.rested.seq };
    assert_eq!(reduce_order(&mut t.venue(), seat, handle, 1_000, 1).unwrap_err() as u32, EventsError::ReduceNotSmaller as u32);
    assert_eq!(reduce_order(&mut t.venue(), seat, handle, 500, 1).unwrap().0, 1_000);
    t.check().unwrap();
    t.place(3, order(Kind::BuyYes, 500, 700, IOC)).unwrap();
    assert_eq!((t.seat(1).yes_locked, t.seat(1).credit), (0, 250_000), "A's reduced order still filled first");
    assert_eq!((t.seat(2).yes_locked, t.seat(2).credit), (800, 100_000));
    t.check().unwrap();
}
