//! One test per row of the fill-kind matrix (events-engine.md §2.1): the maker rests at M = 400, the taker crosses
//! with room to spare, 100 lots fill at the maker's price. Seat deltas, backing and the path bit are exact.

use super::support::*;
use crate::state::{Kind, Path, Seat};

const MAKER: u8 = 1;
const TAKER: u8 = 2;
const M: u16 = 400;
const Q: u64 = 100;

fn balances(s: Seat) -> [u64; 6] {
    [s.credit, s.locked_cash, s.yes_free, s.yes_locked, s.no_free, s.no_locked]
}

/// Seeds what each side needs (outcome for sells), rests the maker, fills the taker, and returns the venue plus
/// the taker's result after checking the path bit and invariants.
fn cross(maker: Kind, taker: Kind, taker_limit: u16, path: Path) -> (TestVenue, agari_common::place_result::PlaceResult) {
    let mut t = TestVenue::new(64, 8, 0);
    for (n, kind) in [(MAKER, maker), (TAKER, taker)] {
        match kind {
            Kind::SellYes => t.seed_pair(n, 9, Q),
            Kind::SellNo => t.seed_pair(9, n, Q),
            Kind::BuyYes | Kind::BuyNo => {}
        }
    }
    t.place(MAKER, order(maker, M, Q, NORMAL)).unwrap();
    let r = t.place(TAKER, order(taker, taker_limit, Q, IOC)).unwrap();
    assert_eq!((r.filled_lots, r.path_mask), (Q, 1 << path as u8), "{maker:?} × {taker:?}");
    assert_eq!(t.book.order_count, 0);
    t.check().unwrap();
    (t, r)
}

#[test]
fn buy_yes_takes_sell_yes_direct_yes() {
    let (t, r) = cross(Kind::SellYes, Kind::BuyYes, 450, Path::DirectYes);
    assert_eq!((r.cash_spent, r.refunded), (Q * 400, Q * 50));
    assert_eq!(balances(t.seat(TAKER)), [0, 0, Q, 0, 0, 0]);
    assert_eq!(balances(t.seat(MAKER)), [Q * 400, 0, 0, 0, 0, 0]);
    assert_eq!(t.market.backing_lots, Q);
}

#[test]
fn sell_yes_hits_buy_yes_direct_yes() {
    let (t, r) = cross(Kind::BuyYes, Kind::SellYes, 350, Path::DirectYes);
    assert_eq!(r.cash_received, Q * 400);
    assert_eq!(balances(t.seat(TAKER)), [Q * 400, 0, 0, 0, 0, 0]);
    assert_eq!(balances(t.seat(MAKER)), [0, 0, Q, 0, 0, 0]);
    assert_eq!(t.market.backing_lots, Q);
}

#[test]
fn buy_no_takes_sell_no_direct_no() {
    let (t, r) = cross(Kind::SellNo, Kind::BuyNo, 350, Path::DirectNo);
    assert_eq!((r.cash_spent, r.refunded), (Q * 600, Q * 50));
    assert_eq!(balances(t.seat(TAKER)), [0, 0, 0, 0, Q, 0]);
    assert_eq!(balances(t.seat(MAKER)), [Q * 600, 0, 0, 0, 0, 0]);
}

#[test]
fn sell_no_hits_buy_no_direct_no() {
    let (t, r) = cross(Kind::BuyNo, Kind::SellNo, 450, Path::DirectNo);
    assert_eq!(r.cash_received, Q * 600);
    assert_eq!(balances(t.seat(TAKER)), [Q * 600, 0, 0, 0, 0, 0]);
    assert_eq!(balances(t.seat(MAKER)), [0, 0, 0, 0, Q, 0]);
}

#[test]
fn buy_yes_takes_buy_no_mint_pair() {
    let (t, r) = cross(Kind::BuyNo, Kind::BuyYes, 450, Path::MintPair);
    assert_eq!(r.cash_spent, Q * 400);
    assert_eq!(balances(t.seat(TAKER)), [0, 0, Q, 0, 0, 0]);
    assert_eq!(balances(t.seat(MAKER)), [0, 0, 0, 0, Q, 0]);
    assert_eq!((t.market.backing_lots, t.mvault), (Q, Q * 1_000));
}

#[test]
fn buy_no_takes_buy_yes_mint_pair() {
    let (t, r) = cross(Kind::BuyYes, Kind::BuyNo, 350, Path::MintPair);
    assert_eq!(r.cash_spent, Q * 600);
    assert_eq!(balances(t.seat(TAKER)), [0, 0, 0, 0, Q, 0]);
    assert_eq!(balances(t.seat(MAKER)), [0, 0, Q, 0, 0, 0]);
    assert_eq!((t.market.backing_lots, t.mvault), (Q, Q * 1_000));
}

#[test]
fn sell_yes_hits_sell_no_burn_pair() {
    let (t, r) = cross(Kind::SellNo, Kind::SellYes, 350, Path::BurnPair);
    assert_eq!(r.cash_received, Q * 400);
    assert_eq!(balances(t.seat(TAKER)), [Q * 400, 0, 0, 0, 0, 0]);
    assert_eq!(balances(t.seat(MAKER)), [Q * 600, 0, 0, 0, 0, 0]);
    assert_eq!(t.market.backing_lots, Q, "2Q seeded against seat 9, Q burned");
}

#[test]
fn sell_no_hits_sell_yes_burn_pair() {
    let (t, r) = cross(Kind::SellYes, Kind::SellNo, 450, Path::BurnPair);
    assert_eq!(r.cash_received, Q * 600);
    assert_eq!(balances(t.seat(TAKER)), [Q * 600, 0, 0, 0, 0, 0]);
    assert_eq!(balances(t.seat(MAKER)), [Q * 400, 0, 0, 0, 0, 0]);
    assert_eq!(t.market.backing_lots, Q, "2Q seeded against seat 9, Q burned");
}
