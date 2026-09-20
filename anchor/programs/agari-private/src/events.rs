//! Two vocabularies that never meet. An OWNER-side event names an owner and an opaque key. A SLOT-side event names a
//! slot and a market. No event, like no instruction and no account, carries an owner and a slot together.

use anchor_lang::prelude::*;

use crate::state::PrivateParams;

// owner side
#[event]
pub struct Deposited {
    pub owner: Pubkey,
    pub amount_base: u64,
    pub balance_base: u64,
}

#[event]
pub struct Allowed {
    pub owner: Pubkey,
    pub allowance_base: u64,
}

#[event]
pub struct Withdrawn {
    pub owner: Pubkey,
    pub amount_base: u64,
    pub balance_base: u64,
}

#[event]
pub struct Charged {
    pub owner: Pubkey,
    pub charge_key: [u8; 32],
    pub amount_base: u64,
}

#[event]
pub struct Credited {
    pub owner: Pubkey,
    pub credit_key: [u8; 32],
    pub amount_base: u64,
}

// slot side
#[event]
pub struct SlotFunded {
    pub slot_id: [u8; 32],
    pub amount_base: u64,
}

#[event]
pub struct SlotMinted {
    pub slot_id: [u8; 32],
    pub market: Pubkey,
    pub outcome: u8,
    pub lots: u64,
    pub cost_base: u64,
}

#[event]
pub struct SlotSettled {
    pub slot_id: [u8; 32],
    pub market: Pubkey,
    pub payout_base: u64,
    pub by: Pubkey,
}

#[event]
pub struct SlotSwept {
    pub slot_id: [u8; 32],
    pub amount_base: u64,
}

// admin
#[event]
pub struct DeskInitialized {
    pub desk_account: Pubkey,
    pub admin: Pubkey,
    pub desk: Pubkey,
    pub collateral_mint: Pubkey,
    pub seat: Pubkey,
}

#[event]
pub struct DeskChanged {
    pub desk: Pubkey,
}

#[event]
pub struct ParamsUpdated {
    pub params: PrivateParams,
}

#[event]
pub struct PausedSet {
    pub paused: bool,
}
