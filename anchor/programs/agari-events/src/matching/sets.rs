//! Complete sets and credit withdrawal (events-engine.md §8.1; events-instructions.md §4.1–§4.3). A pair costs
//! exactly `lots × 1000 × cu`, so minting and merging move `backing_lots` with no rounding.

use agari_common::grid::PAIR_TICKS;
use anchor_lang::prelude::Pubkey;

use super::seats::{bond_for, fund, resolve_seat, sweep_credit, Funding};
use crate::errors::EventsError;
use crate::state::{Ledger, Market, Seat};

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SetOutcome {
    pub seat: u16,
    /// `lots × 1000 × cu`.
    pub cash: u64,
    pub funding: Funding,
    pub withdrawn: u64,
}

fn pair_cash(lots: u64, cu: u64) -> Result<u64, EventsError> {
    lots.checked_mul(PAIR_TICKS).and_then(|x| x.checked_mul(cu)).ok_or(EventsError::MathOverflow)
}

/// Mint (steps 4–5 and effects): claims a seat if needed, pulls the pair cost (+ bond) credit-first, adds a YES
/// and a NO per lot.
pub fn mint_set(ledger: &mut Ledger, seats: &mut [Seat], market: &mut Market, cu: u64, authority: &Pubkey, seat_hint: u16, lots: u64, use_credit: bool) -> Result<SetOutcome, EventsError> {
    if lots == 0 {
        return Err(EventsError::InvalidQuantity);
    }
    let seat_use = resolve_seat(ledger, seats, authority, seat_hint)?;
    let cash = pair_cash(lots, cu)?;
    let need = cash.checked_add(bond_for(ledger, seat_use)).ok_or(EventsError::MathOverflow)?;
    market.backing_lots = market.backing_lots.checked_add(lots).ok_or(EventsError::MathOverflow)?;
    let seat = &mut seats[usize::from(seat_use.index)];
    seat.yes_free = seat.yes_free.checked_add(lots).ok_or(EventsError::MathOverflow)?;
    seat.no_free = seat.no_free.checked_add(lots).ok_or(EventsError::MathOverflow)?;
    let funding = fund(seat, need, use_credit);
    Ok(SetOutcome { seat: seat_use.index, cash, funding, withdrawn: 0 })
}

/// Merge (step 2 and effects) on a seat the caller already resolved with `owned_seat`: burns a YES and a NO per
/// lot for `lots × 1000 × cu` of credit, optionally withdrawn.
pub fn merge_set(seats: &mut [Seat], market: &mut Market, cu: u64, seat: u16, lots: u64, withdraw: bool) -> Result<SetOutcome, EventsError> {
    if lots == 0 {
        return Err(EventsError::InvalidQuantity);
    }
    let cash = pair_cash(lots, cu)?;
    let s = seats.get_mut(usize::from(seat)).ok_or(EventsError::SeatMismatch)?;
    if s.yes_free < lots || s.no_free < lots {
        return Err(EventsError::InsufficientOutcome);
    }
    s.yes_free -= lots;
    s.no_free -= lots;
    s.credit = s.credit.checked_add(cash).ok_or(EventsError::MathOverflow)?;
    let withdrawn = sweep_credit(s, withdraw);
    market.backing_lots = market.backing_lots.checked_sub(lots).ok_or(EventsError::MathOverflow)?;
    Ok(SetOutcome { seat, cash, funding: Funding::default(), withdrawn })
}

/// `0 < amount ≤ credit` (InsufficientCredit), then `credit −= amount`.
pub fn withdraw_credit(seat: &mut Seat, amount: u64) -> Result<(), EventsError> {
    if amount == 0 || amount > seat.credit {
        return Err(EventsError::InsufficientCredit);
    }
    seat.credit -= amount;
    Ok(())
}
