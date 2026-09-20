use anchor_lang::prelude::*;

use crate::state::PositionStatus;

#[event]
pub struct ReserveInitialized {
    pub reserve: Pubkey,
    pub admin: Pubkey,
    pub collateral_mint: Pubkey,
    pub seat: Pubkey,
}

#[event]
pub struct ParamsUpdated {
    pub reserve: Pubkey,
    pub paused: bool,
}

#[event]
pub struct Supplied {
    pub provider: Pubkey,
    pub amount_base: u64,
    pub shares: u64,
    pub total_value_base: u64,
}

#[event]
pub struct Withdrawn {
    pub provider: Pubkey,
    pub amount_base: u64,
    pub shares: u64,
    pub total_value_base: u64,
}

/// Everything a reader needs to re-derive the terms: what was bought, what it cost, and who put in what.
#[event]
pub struct Opened {
    pub position: Pubkey,
    pub position_id: u64,
    pub owner: Pubkey,
    pub market: Pubkey,
    pub outcome: u8,
    pub leverage_bps: u32,
    pub lots: u64,
    pub cost_base: u64,
    pub stake_base: u64,
    pub fronted_base: u64,
    pub premium_base: u64,
}

/// A sale or a redemption. `status` is Live while contracts remain, otherwise how the position ended.
#[event]
pub struct Exited {
    pub position: Pubkey,
    pub position_id: u64,
    pub owner: Pubkey,
    pub status: PositionStatus,
    pub lots_sold: u64,
    pub proceeds_base: u64,
    pub reclaimed_base: u64,
    pub returned_base: u64,
    /// What of `returned_base` could not be paid at once and waits for `public_claim`.
    pub owed_base: u64,
    pub by: Pubkey,
}

#[event]
pub struct Claimed {
    pub position: Pubkey,
    pub position_id: u64,
    pub owner: Pubkey,
    pub paid_base: u64,
}
