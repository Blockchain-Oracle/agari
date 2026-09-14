//! events-engine.md §2.2, the eight worked examples, reproduced exactly (launch grid, `cu = 1`, `seat_bond = 0`).
//! Seats: A = 1, B = 2, C = 3, D = 4; seed counterparties 9 (they only hold the other side of seeded pairs).

use agari_common::grid::PAYOUT_DENOMINATOR;

use super::support::*;
use crate::matching::orders::sweep_expired;
use crate::state::{Kind, Path, StopReason};

const A: u8 = 1;
const B: u8 = 2;
const C: u8 = 3;
const D: u8 = 4;
const SEED: u8 = 9;

const fn mask(p: Path) -> u8 {
    1 << p as u8
}

#[test]
fn example_1_direct_yes() {
    let mut t = TestVenue::new(256, 16, 0);
    t.seed_pair(A, SEED, 5_000);
    t.place(A, order(Kind::SellYes, 540, 5_000, NORMAL)).unwrap();
    assert_eq!((t.seat(A).yes_free, t.seat(A).yes_locked), (0, 5_000));
    let r = t.place(B, order(Kind::BuyYes, 560, 3_000, IOC)).unwrap();
    assert_eq!((r.filled_lots, r.cash_spent, r.refunded, r.transferred_in, r.fills, r.path_mask), (3_000, 1_620_000, 60_000, 1_620_000, 1, mask(Path::DirectYes)));
    assert_eq!(t.seat(B).yes_free, 3_000);
    assert_eq!((t.seat(A).yes_locked, t.seat(A).credit), (2_000, 1_620_000));
    assert_eq!(t.market.backing_lots, 5_000);
    t.check().unwrap();
}

#[test]
fn example_2_direct_no() {
    let mut t = TestVenue::new(256, 16, 0);
    t.seed_pair(SEED, A, 2_000);
    t.place(A, order(Kind::SellNo, 450, 2_000, NORMAL)).unwrap();
    let r = t.place(C, order(Kind::BuyNo, 430, 2_000, IOC)).unwrap();
    assert_eq!((r.cash_spent, r.refunded, r.path_mask), (1_100_000, 40_000, mask(Path::DirectNo)));
    assert_eq!(t.seat(C).no_free, 2_000);
    assert_eq!((t.seat(A).no_locked, t.seat(A).credit), (0, 1_100_000));
    t.check().unwrap();
}

/// Example 3's state, reused by example 8.
fn mint_pair_state() -> TestVenue {
    let mut t = TestVenue::new(256, 16, 0);
    let rest = t.place(A, order(Kind::BuyYes, 620, 10_000, NORMAL)).unwrap();
    assert_eq!((rest.transferred_in, rest.rested_lots, t.seat(A).locked_cash, t.mvault), (6_200_000, 10_000, 6_200_000, 6_200_000));
    let r = t.place(D, order(Kind::BuyNo, 600, 4_000, IOC)).unwrap();
    assert_eq!((r.cash_spent, r.refunded, r.path_mask), (1_520_000, 80_000, mask(Path::MintPair)));
    t
}

#[test]
fn example_3_mint_pair() {
    let t = mint_pair_state();
    assert_eq!(t.seat(D).no_free, 4_000);
    assert_eq!((t.seat(A).locked_cash, t.seat(A).yes_free), (3_720_000, 4_000));
    assert_eq!(t.market.backing_lots, 4_000);
    assert_eq!(t.mvault, 7_720_000);
    assert_eq!(t.mvault, t.seat(A).locked_cash + t.market.backing_lots * 1_000);
    t.check().unwrap();
}

#[test]
fn example_4_burn_pair() {
    let mut t = TestVenue::new(256, 16, 0);
    t.seed_pair(A, D, 4_000);
    t.place(A, order(Kind::SellYes, 700, 4_000, NORMAL)).unwrap();
    let r = t.place(D, order(Kind::SellNo, 720, 4_000, IOC)).unwrap();
    assert_eq!((r.cash_received, r.path_mask), (1_200_000, mask(Path::BurnPair)));
    assert_eq!((t.seat(D).credit, t.seat(A).credit), (1_200_000, 2_800_000));
    assert_eq!(t.market.backing_lots, 0);
    assert_eq!(t.mvault, 4_000_000);
    t.check().unwrap();
}

#[test]
fn example_5_credit_first_funding() {
    let mut t = TestVenue::new(256, 16, 0);
    t.seed_credit(A, 3_720_000);
    let r = t.place(A, order(Kind::BuyNo, 300, 5_000, NORMAL).with_credit()).unwrap();
    assert_eq!((r.rested_lots, r.credit_used, r.transferred_in), (5_000, 3_500_000, 0));
    assert_eq!((t.seat(A).credit, t.seat(A).locked_cash), (220_000, 3_500_000));
    t.check().unwrap();
}

#[test]
fn example_6_fill_cap_cancels_the_remainder() {
    let mut t = TestVenue::new(256, 16, 0);
    t.place(11, order(Kind::BuyNo, 550, 1_000, NORMAL)).unwrap();
    t.place(12, order(Kind::BuyNo, 560, 1_000, NORMAL)).unwrap();
    t.place(13, order(Kind::BuyNo, 580, 5_000, NORMAL)).unwrap();
    let mut o = order(Kind::BuyYes, 600, 10_000, NORMAL);
    o.max_fills = 2;
    let r = t.place(B, o).unwrap();
    assert_eq!((r.fills, r.filled_lots, r.cash_spent), (2, 2_000, 1_110_000));
    assert_eq!((r.stop_reason, r.cancelled_lots, r.rested_lots, r.refunded), (StopReason::FillCap as u8, 8_000, 0, 4_890_000));
    assert_eq!(t.book.order_count, 1, "Z still rests; nothing rested crossed");
    assert_eq!(t.seat(B).open_orders, 0);
    t.check().unwrap();
}

#[test]
fn example_7_post_only_over_its_own_expired_quote_rests() {
    let mut t = TestVenue::new(256, 16, 0);
    let mut quote = order(Kind::BuyNo, 610, 2_000, NORMAL);
    quote.expire_ts = START + 10;
    t.place(A, quote).unwrap();
    t.now = START + 10;
    let r = t.place(A, order(Kind::BuyYes, 612, 2_000, POST_ONLY)).unwrap();
    assert_eq!((r.evictions, r.rested_lots, r.stop_reason, r.filled_lots), (1, 2_000, StopReason::PostOnlyRested as u8, 0));
    assert_eq!(t.seat(A).credit, 2_000 * 390);
    t.check().unwrap();
}

#[test]
fn example_8_settle_and_redeem_from_state_3() {
    let mut t = mint_pair_state();
    t.now = t.market.lock_at;
    let swept = sweep_expired(&mut t.venue(), 32, true).unwrap();
    assert_eq!(swept.len(), 1);
    assert_eq!((t.seat(A).credit, t.seat(A).locked_cash), (3_720_000, 0));
    t.check().unwrap();
    // The redeem formula (§8.4) on the resulting seats: Up wins, then void.
    let denominator = u128::from(PAYOUT_DENOMINATOR);
    let redeem = |t: &TestVenue, n: u8, yes_n: u128, no_n: u128| {
        let s = t.seat(n);
        u128::from(s.credit) + (u128::from(s.yes_free) * 1_000 * yes_n + u128::from(s.no_free) * 1_000 * no_n) / denominator
    };
    let (win, lose, half) = (denominator, 0, denominator / 2);
    assert_eq!((redeem(&t, A, win, lose), redeem(&t, D, win, lose)), (7_720_000, 0));
    assert_eq!((redeem(&t, A, half, half), redeem(&t, D, half, half)), (5_720_000, 2_000_000));
    assert_eq!(u128::from(t.mvault), redeem(&t, A, half, half) + redeem(&t, D, half, half));
}
