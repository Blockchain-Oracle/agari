//! `VaultAccount` PDA `["acct", owner]`: one owner's Trading Balance and its inline position slots (vault.md §2,
//! D-062). Slot sides hold lots in the vault's PROGRAM seat; the slot's grant ids say which grant opened each side.

use anchor_lang::prelude::*;

use crate::constants::{GRANT_KINDS, MAX_POSITION_SLOTS};

/// 64 B. A slot is free while `market` is the default key.
#[zero_copy]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct PositionSlot {
    /// The agari-events Market PDA.
    pub market: Pubkey,
    pub yes_lots: u64,
    pub no_lots: u64,
    /// The grant that opened the YES side; 0 = attended.
    pub yes_grant: u64,
    pub no_grant: u64,
}

impl PositionSlot {
    pub fn is_free(&self) -> bool {
        self.market == Pubkey::default()
    }

    /// `(lots, grant)` of one side: `0` YES, anything else NO (callers validate the outcome first).
    pub fn side(&self, outcome: u8) -> (u64, u64) {
        if outcome == 0 {
            (self.yes_lots, self.yes_grant)
        } else {
            (self.no_lots, self.no_grant)
        }
    }

    pub fn side_mut(&mut self, outcome: u8) -> (&mut u64, &mut u64) {
        if outcome == 0 {
            (&mut self.yes_lots, &mut self.yes_grant)
        } else {
            (&mut self.no_lots, &mut self.no_grant)
        }
    }
}

/// 1,152 B struct (128 B header + 16 × 64 B slots), 1,160 B account.
#[account(zero_copy)]
pub struct VaultAccount {
    pub owner: Pubkey,
    /// Free Trading Balance (base units).
    pub available: u64,
    /// The private bucket (`moveToPrivate`).
    pub private_available: u64,
    pub total_deposited: u64,
    pub total_withdrawn: u64,
    /// The live grant id per kind (SESSION, EXECUTOR, STRATEGY); 0 = none.
    pub active_grants: [u64; GRANT_KINDS],
    pub custody_bump: u8,
    pub bump: u8,
    /// Slots whose `market` is set.
    pub slots_used: u16,
    pub _pad: [u8; 4],
    pub _reserved: [u8; 32],
    pub positions: [PositionSlot; MAX_POSITION_SLOTS],
}

impl VaultAccount {
    /// The slot holding `market`, if any.
    pub fn slot_of(&self, market: &Pubkey) -> Option<usize> {
        self.positions.iter().position(|s| s.market == *market)
    }
}
