//! `Ledger` PDA `["ledger", market]`: a zero-copy header plus a growable seat slab (events-accounts.md §3.8,
//! PD-8, D-006). Seats are a `cast_slice` over the bytes after the header; `seats.len() == capacity`.

use anchor_lang::{prelude::*, Discriminator};

use super::enums::{SEAT_FLAG_BONDED, SEAT_FLAG_PROGRAM};
use crate::constants::{LEDGER_HEADER_LEN, SEAT_LEN};

/// 96 B header.
#[account(zero_copy)]
pub struct Ledger {
    pub market: Pubkey,
    pub rent_payer: Pubkey,
    /// Refundable bond a new seat posts; copied from the Series at open.
    pub seat_bond: u64,
    pub capacity: u16,
    /// Scan high-water mark: seats `≥ seats_used` have never been claimed.
    pub seats_used: u16,
    pub bump: u8,
    pub _pad0: [u8; 3],
    pub _reserved: [u8; 16],
}

/// 88 B. Cash fields are collateral base units; outcome fields are lots.
#[zero_copy]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Seat {
    /// `Pubkey::default()` = empty.
    pub owner: Pubkey,
    pub credit: u64,
    pub locked_cash: u64,
    pub yes_free: u64,
    pub yes_locked: u64,
    pub no_free: u64,
    pub no_locked: u64,
    pub open_orders: u16,
    pub flags: u8,
    pub _pad0: [u8; 5],
}

impl Seat {
    pub fn is_empty(&self) -> bool {
        self.owner == Pubkey::default()
    }

    pub const fn is_program(&self) -> bool {
        self.flags & SEAT_FLAG_PROGRAM != 0
    }

    pub const fn is_bonded(&self) -> bool {
        self.flags & SEAT_FLAG_BONDED != 0
    }

    /// All six balances zero and no open orders; the bond is not a balance (events-engine.md §6).
    pub const fn is_drained(&self) -> bool {
        self.credit == 0
            && self.locked_cash == 0
            && self.yes_free == 0
            && self.yes_locked == 0
            && self.no_free == 0
            && self.no_locked == 0
            && self.open_orders == 0
    }
}

/// Account bytes for a Ledger of `capacity` seats (discriminator included).
pub const fn ledger_space(capacity: usize) -> usize {
    Ledger::DISCRIMINATOR.len() + LEDGER_HEADER_LEN + SEAT_LEN * capacity
}

/// Header and seats of a Ledger's account data, checked for discriminator, length and alignment. Take the data
/// with `try_borrow_mut_data` (never `AccountLoader::load_mut`, which would borrow the seats too).
pub fn ledger_parts_mut(data: &mut [u8]) -> Result<(&mut Ledger, &mut [Seat])> {
    let disc_len = Ledger::DISCRIMINATOR.len();
    if data.len() < disc_len + LEDGER_HEADER_LEN || &data[..disc_len] != Ledger::DISCRIMINATOR {
        return Err(ErrorCode::AccountDiscriminatorMismatch.into());
    }
    let (header, seats) = data[disc_len..].split_at_mut(LEDGER_HEADER_LEN);
    let header: &mut Ledger = bytemuck::try_from_bytes_mut(header).map_err(|_| ErrorCode::AccountDidNotDeserialize)?;
    if seats.len() != usize::from(header.capacity) * SEAT_LEN {
        return Err(ErrorCode::AccountDidNotDeserialize.into());
    }
    let seats: &mut [Seat] = bytemuck::try_cast_slice_mut(seats).map_err(|_| ErrorCode::AccountDidNotDeserialize)?;
    Ok((header, seats))
}
