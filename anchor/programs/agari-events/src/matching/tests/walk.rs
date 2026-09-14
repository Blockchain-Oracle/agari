//! The book walks read the engine's own Book: resting orders placed through `place` come back as levels, best first,
//! with expired and not-yet-rested orders filtered out (events-engine.md §9).

use agari_common::book_walk::{levels, NodeFilter, Side};

use super::support::*;
use crate::book::{walk_asks, walk_bids};
use crate::state::Kind;

#[test]
fn walks_see_the_engine_book_through_the_traits() {
    let mut t = TestVenue::new(64, 8, 0);
    t.place(1, order(Kind::BuyYes, 480, 100, NORMAL)).unwrap();
    t.place(2, order(Kind::BuyYes, 490, 50, NORMAL)).unwrap();
    t.place(3, order(Kind::BuyYes, 490, 25, NORMAL).expires(START + 5)).unwrap();
    t.place(4, order(Kind::BuyNo, 600, 70, NORMAL)).unwrap();
    t.slot = 10;
    t.place(5, order(Kind::BuyNo, 610, 30, NORMAL)).unwrap();
    let filter = NodeFilter { now: START, slot: 10, rested_only: false, min_rest_slots: 5 };
    assert_eq!(levels(&walk_bids(&t.book, &t.nodes), Side::Bid, 32, &filter), vec![(490, 75), (480, 100)]);
    assert_eq!(levels(&walk_asks(&t.book, &t.nodes), Side::Ask, 32, &filter), vec![(600, 70), (610, 30)]);
    let later = NodeFilter { now: START + 5, slot: 14, rested_only: true, min_rest_slots: 5 };
    assert_eq!(levels(&walk_bids(&t.book, &t.nodes), Side::Bid, 32, &later), vec![(490, 50), (480, 100)], "expired order skipped");
    assert_eq!(levels(&walk_asks(&t.book, &t.nodes), Side::Ask, 32, &later), vec![(600, 70)], "the slot-10 order hasn't rested 5 slots");
}
