//! Redemption over the pure core (events-engine.md §8.4–8.5): example 8 under Up, Down and void with a real seat
//! bond, every refusal, PROGRAM-seat partial redeem, and the Ledger-emptiness rule `public_close_ledger` uses.

use super::support::*;
use crate::errors::EventsError;
use crate::matching::orders::sweep_expired;
use crate::matching::redeem::{ledger_is_empty, redeem};
use crate::matching::seats::owned_seat;
use crate::matching::sets::mint_set;
use crate::state::{Kind, MarketState, SEAT_FLAG_PROGRAM};

const A: u8 = 1;
const D: u8 = 4;
const PRODUCT: u8 = 7;
const BOND: u64 = 250_000;
const WIN: u32 = 10_000_000;
const HALF: u32 = 5_000_000;

/// Example 3 with a 250,000 seat bond: A rests BUY_YES 10,000 @ 620, D mints 4,000 pairs against it.
fn example_3_with_bond() -> TestVenue {
    let mut t = TestVenue::new(256, 16, BOND);
    t.place(A, order(Kind::BuyYes, 620, 10_000, NORMAL)).unwrap();
    t.place(D, order(Kind::BuyNo, 600, 4_000, IOC)).unwrap();
    assert_eq!(t.mvault, 7_720_000 + 2 * BOND);
    t
}

fn settle(t: &mut TestVenue, payout_yes: u32, payout_no: u32) {
    t.market.state = u8::from(if payout_yes == payout_no { MarketState::Voided } else { MarketState::Resolved });
    (t.market.payout_yes, t.market.payout_no) = (payout_yes, payout_no);
}

/// Sweeps the Book after `lock_at`, then settles.
fn locked_and_settled(payout_yes: u32, payout_no: u32) -> TestVenue {
    let mut t = example_3_with_bond();
    t.now = t.market.lock_at;
    t.atomic(|t| sweep_expired(&mut t.venue(), 32, true).map(|_| ((), 0, 0))).unwrap();
    t.check().unwrap();
    settle(&mut t, payout_yes, payout_no);
    t
}

/// A full redeem of `n`'s seat, moving the mvault model by what it pays.
fn full(t: &mut TestVenue, n: u8) -> Result<u64, EventsError> {
    let si = usize::from(owned_seat(&t.ledger, &t.seats, &who(n), t.seat_of(n).unwrap_or(0))?);
    let (market, cu, bond) = (t.market, t.cu, t.ledger.seat_bond);
    t.atomic(|t| redeem(&mut t.seats[si], &market, cu, bond, None, None).map(|r| (r.total, 0, r.total)))
}

#[test]
fn example_8_pays_to_the_base_unit_under_up_down_and_void_with_the_bond() {
    // (payout vector, A's total, D's total): credit 3,720,000 back to A, the 4,000 pairs to the winner, each bond back.
    for (yes, no, a_total, d_total) in [(WIN, 0, 3_720_000 + 4_000_000 + BOND, BOND), (0, WIN, 3_720_000 + BOND, 4_000_000 + BOND), (HALF, HALF, 3_720_000 + 2_000_000 + BOND, 2_000_000 + BOND)] {
        let mut t = locked_and_settled(yes, no);
        let before = t.mvault;
        assert_eq!((full(&mut t, A).unwrap(), full(&mut t, D).unwrap()), (a_total, d_total), "payout ({yes}, {no})");
        assert_eq!((a_total + d_total, t.mvault), (before, 0), "everything owed is paid, nothing more");
        assert!(ledger_is_empty(&t.ledger, &t.seats));
    }
}

#[test]
fn redeem_refuses_until_terminal_and_drained_and_never_pays_twice() {
    let mut t = example_3_with_bond();
    let (a_seat, d_seat) = (usize::from(t.seat_of(A).unwrap()), usize::from(t.seat_of(D).unwrap()));
    let (market, bond) = (t.market, t.ledger.seat_bond);
    assert_eq!(err_code(redeem(&mut t.seats[d_seat], &market, 1, bond, None, None)), EventsError::MarketNotTerminal as u32);

    settle(&mut t, WIN, 0);
    let market = t.market;
    assert_eq!(err_code(redeem(&mut t.seats[a_seat], &market, 1, bond, None, None)), EventsError::OpenOrdersRemain as u32, "A's bid still rests");
    assert_eq!(err_code(redeem(&mut t.seats[d_seat], &market, 1, bond, Some(1), None)), EventsError::InvalidOrderArgs as u32);
    assert_eq!(err_code(redeem(&mut t.seats[d_seat], &market, 1, bond, None, Some(10))), EventsError::InvalidOrderArgs as u32);
    assert_eq!(err_code(redeem(&mut t.seats[d_seat], &market, 1, bond, Some(1), Some(1_000))), EventsError::PartialRedeemNotAllowed as u32);
    assert!(!ledger_is_empty(&t.ledger, &t.seats), "an unredeemed seat keeps the Ledger open");

    // A sweep drains the orders (terminal ⇒ drain all), then both redeem once. A cleared seat no longer resolves.
    t.atomic(|t| sweep_expired(&mut t.venue(), 32, true).map(|_| ((), 0, 0))).unwrap();
    assert_eq!(full(&mut t, A).unwrap(), 7_970_000);
    assert_eq!(full(&mut t, D).unwrap(), BOND);
    assert_eq!(err_code(owned_seat(&t.ledger, &t.seats, &who(A), a_seat as u16)), EventsError::SeatMismatch as u32, "a second redeem is refused, not paid 0");
    assert_eq!(t.mvault, 0);
}

#[test]
fn a_program_seat_redeems_part_then_the_rest_and_keeps_its_seat() {
    let mut t = TestVenue::new(256, 16, BOND);
    t.seats[0].owner = who(PRODUCT);
    t.seats[0].flags = SEAT_FLAG_PROGRAM;
    t.ledger.seats_used = 1;
    t.atomic(|t| {
        let (cu, product) = (t.cu, who(PRODUCT));
        let o = mint_set(&mut t.ledger, &mut t.seats, &mut t.market, cu, &product, 0, 2_000, false)?;
        Ok(((), o.funding.transferred_in, 0))
    })
    .unwrap();
    assert_eq!(t.mvault, 2_000_000, "no bond on a PROGRAM seat");
    settle(&mut t, WIN, 0);
    let (market, bond) = (t.market, t.ledger.seat_bond);
    let s = &mut t.seats[0];
    assert_eq!(err_code(redeem(s, &market, 1, bond, Some(0), Some(2_001))), EventsError::InsufficientOutcome as u32);
    assert_eq!(err_code(redeem(s, &market, 1, bond, Some(2), Some(1))), EventsError::InvalidOrderArgs as u32);
    assert_eq!(err_code(redeem(s, &market, 1, bond, Some(0), Some(0))), EventsError::InvalidQuantity as u32);
    let yes = redeem(s, &market, 1, bond, Some(0), Some(1_500)).unwrap();
    let no = redeem(s, &market, 1, bond, Some(1), Some(2_000)).unwrap();
    assert_eq!((yes.total, yes.yes_lots, no.total, no.no_lots, s.yes_free, s.no_free), (1_500_000, 1_500, 0, 2_000, 500, 0));
    let rest = redeem(s, &market, 1, bond, None, None).unwrap();
    assert_eq!((rest.total, rest.bond, s.owner, s.flags), (500_000, 0, who(PRODUCT), SEAT_FLAG_PROGRAM));
    assert_eq!(yes.total + no.total + rest.total, t.mvault);
    assert!(ledger_is_empty(&t.ledger, &t.seats));
}

/// The error code of a refused call (`EventsError` carries no `PartialEq`).
fn err_code<T: core::fmt::Debug>(r: Result<T, EventsError>) -> u32 {
    r.unwrap_err() as u32
}
