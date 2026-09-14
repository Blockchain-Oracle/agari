//! Seat addressing and claims (events-engine.md §6, PD-8). One seat per owner, so self-match detection and the
//! per-seat open-order cap hold. Claims happen only in `user_place_order` and `user_mint_complete_set`.

use anchor_lang::prelude::Pubkey;

use crate::errors::EventsError;
use crate::state::{Ledger, Seat, SEAT_FLAG_BONDED};

/// The seat slice a Ledger header describes (never past its bytes).
fn capacity(ledger: &Ledger, seats: &[Seat]) -> usize {
    usize::from(ledger.capacity).min(seats.len())
}

/// `SI`: `seat_idx < capacity` and the seat is `authority`'s (SeatMismatch).
pub fn owned_seat(ledger: &Ledger, seats: &[Seat], authority: &Pubkey, seat_idx: u16) -> Result<usize, EventsError> {
    let i = usize::from(seat_idx);
    if i < capacity(ledger, seats) && seats[i].owner == *authority {
        Ok(i)
    } else {
        Err(EventsError::SeatMismatch)
    }
}

/// A seat claimed by this call: the caller adds `ledger.seat_bond` to what it pulls.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct SeatUse {
    pub index: u16,
    pub claimed: bool,
}

/// Resolves `seat_hint` (§6):
/// - the hinted seat is already `authority`'s → use it;
/// - the hinted seat is empty → claim it;
/// - `u16::MAX` → claim the first empty seat (`LedgerFull` if none);
/// - anything else → `SeatMismatch`.
///
/// A claim first refuses an authority that already holds another seat (`SeatMismatch`).
pub fn resolve_seat(ledger: &mut Ledger, seats: &mut [Seat], authority: &Pubkey, seat_hint: u16) -> Result<SeatUse, EventsError> {
    let cap = capacity(ledger, seats);
    let index = if seat_hint == u16::MAX {
        if seats[..usize::from(ledger.seats_used).min(cap)].iter().any(|s| s.owner == *authority) {
            return Err(EventsError::SeatMismatch);
        }
        seats[..cap].iter().position(Seat::is_empty).ok_or(EventsError::LedgerFull)?
    } else {
        let i = usize::from(seat_hint);
        if i >= cap {
            return Err(EventsError::SeatMismatch);
        }
        if seats[i].owner == *authority {
            return Ok(SeatUse { index: seat_hint, claimed: false });
        }
        if !seats[i].is_empty() || seats[..usize::from(ledger.seats_used).min(cap)].iter().any(|s| s.owner == *authority) {
            return Err(EventsError::SeatMismatch);
        }
        i
    };
    let seat = &mut seats[index];
    seat.owner = *authority;
    seat.flags |= SEAT_FLAG_BONDED;
    let used = u16::try_from(index + 1).map_err(|_| EventsError::LedgerFull)?;
    ledger.seats_used = ledger.seats_used.max(used);
    Ok(SeatUse { index: used - 1, claimed: true })
}

/// What a caller owes the Ledger for a claim this call made.
pub const fn bond_for(ledger: &Ledger, seat: SeatUse) -> u64 {
    if seat.claimed {
        ledger.seat_bond
    } else {
        0
    }
}

/// Funding after the fact (§4.1): credit first when allowed, then one transfer for the rest.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Funding {
    pub credit_used: u64,
    pub transferred_in: u64,
}

pub fn fund(seat: &mut Seat, need: u64, use_credit: bool) -> Funding {
    let credit_used = if use_credit { seat.credit.min(need) } else { 0 };
    seat.credit -= credit_used;
    Funding { credit_used, transferred_in: need - credit_used }
}

/// `withdraw_proceeds` / `withdraw` (§4.3): the whole post-trade credit leaves; returns the amount.
pub fn sweep_credit(seat: &mut Seat, withdraw: bool) -> u64 {
    if !withdraw {
        return 0;
    }
    let out = seat.credit;
    seat.credit = 0;
    out
}
