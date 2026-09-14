//! Redemption and ledger emptiness (events-engine.md §8.4–8.5; events-instructions.md §5.3–5.5) as pure functions
//! over one seat, so the handlers and the native randomized harness run the same money code.
//!
//! Full redeem pays `credit + ⌊(yes·1000·cu·yN + no·1000·cu·nN)/10⁷⌋ + bond`. Once `open_orders == 0` the §8.3
//! escrow invariant makes `locked_cash`, `yes_locked` and `no_locked` zero; they are still folded into the payout
//! (D-022), so a broken invariant could never strand escrow in the mvault. On every valid grid the result is exact.

use agari_common::grid::{partial_payout, redeem_payout};
use anchor_lang::prelude::Pubkey;

use crate::errors::EventsError;
use crate::state::{Ledger, Market, Seat, SEAT_FLAG_PROGRAM};

/// What one redeem paid and why (the `Redeemed` event body).
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Redemption {
    pub owner: Pubkey,
    pub yes_lots: u64,
    pub no_lots: u64,
    /// The outcome payout alone.
    pub payout: u64,
    /// Credit (and any escrow) returned.
    pub credit: u64,
    pub bond: u64,
    /// `credit + payout + bond`: what leaves the mvault.
    pub total: u64,
    pub partial: bool,
}

fn add(a: u64, b: u64) -> Result<u64, EventsError> {
    a.checked_add(b).ok_or(EventsError::MathOverflow)
}

/// Steps 2–4 of `user_redeem` after the seat is resolved: terminal, no open orders, then the argument shape.
/// `(None, None)` is a full redeem; `(Some, Some)` a partial one (PROGRAM seats only); anything else is refused.
pub fn redeem(seat: &mut Seat, market: &Market, cash_unit: u64, seat_bond: u64, outcome: Option<u8>, lots: Option<u64>) -> Result<Redemption, EventsError> {
    if !market.is_terminal() {
        return Err(EventsError::MarketNotTerminal);
    }
    if seat.open_orders != 0 {
        return Err(EventsError::OpenOrdersRemain);
    }
    match (outcome, lots) {
        (None, None) => redeem_full(seat, market, cash_unit, seat_bond),
        (Some(outcome), Some(lots)) => redeem_partial(seat, market, cash_unit, outcome, lots),
        _ => Err(EventsError::InvalidOrderArgs),
    }
}

/// Pays everything the seat holds and zeroes it. A PROGRAM seat keeps its owner and flag (products reuse it); any
/// other seat is cleared, so a second redeem of it no longer resolves (SeatMismatch) instead of silently paying 0.
pub fn redeem_full(seat: &mut Seat, market: &Market, cash_unit: u64, seat_bond: u64) -> Result<Redemption, EventsError> {
    let yes_lots = add(seat.yes_free, seat.yes_locked)?;
    let no_lots = add(seat.no_free, seat.no_locked)?;
    let payout = redeem_payout(yes_lots, no_lots, cash_unit, market.payout_yes, market.payout_no).ok_or(EventsError::MathOverflow)?;
    let credit = add(seat.credit, seat.locked_cash)?;
    let bond = if seat.is_bonded() { seat_bond } else { 0 };
    let total = add(add(credit, payout)?, bond)?;
    let owner = seat.owner;
    if seat.is_program() {
        // Only the PROGRAM flag survives: a paid bond must not keep the Ledger from closing.
        *seat = Seat { owner, flags: SEAT_FLAG_PROGRAM, ..Seat::default() };
    } else {
        *seat = Seat::default();
    }
    Ok(Redemption { owner, yes_lots, no_lots, payout, credit, bond, total, partial: false })
}

/// Redeems `lots` of one outcome (`0` YES, `1` NO) from a PROGRAM seat's free balance; credit is untouched.
pub fn redeem_partial(seat: &mut Seat, market: &Market, cash_unit: u64, outcome: u8, lots: u64) -> Result<Redemption, EventsError> {
    if !seat.is_program() {
        return Err(EventsError::PartialRedeemNotAllowed);
    }
    let (free, numerator) = match outcome {
        0 => (&mut seat.yes_free, market.payout_yes),
        1 => (&mut seat.no_free, market.payout_no),
        _ => return Err(EventsError::InvalidOrderArgs),
    };
    if lots == 0 {
        return Err(EventsError::InvalidQuantity);
    }
    if lots > *free {
        return Err(EventsError::InsufficientOutcome);
    }
    let payout = partial_payout(lots, cash_unit, numerator).ok_or(EventsError::MathOverflow)?;
    *free -= lots;
    let (yes_lots, no_lots) = if outcome == 0 { (lots, 0) } else { (0, lots) };
    Ok(Redemption { owner: seat.owner, yes_lots, no_lots, payout, credit: 0, bond: 0, total: payout, partial: true })
}

/// `public_close_ledger` step 5: every seat in `0..seats_used` is drained and holds no bond.
pub fn ledger_is_empty(ledger: &Ledger, seats: &[Seat]) -> bool {
    let used = usize::from(ledger.seats_used).min(usize::from(ledger.capacity)).min(seats.len());
    seats[..used].iter().all(|s| s.is_drained() && !s.is_bonded())
}
