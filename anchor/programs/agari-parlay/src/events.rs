use anchor_lang::prelude::*;

use crate::state::LegStatus;

#[event]
pub struct ReserveInitialized {
    pub reserve: Pubkey,
    pub admin: Pubkey,
    pub collateral_mint: Pubkey,
}

#[event]
pub struct ParamsUpdated {
    pub reserve: Pubkey,
    pub paused: bool,
}

#[event]
pub struct Supplied {
    pub reserve: Pubkey,
    pub provider: Pubkey,
    pub amount_base: u64,
    pub shares: u64,
    pub equity_base: u64,
}

#[event]
pub struct Withdrawn {
    pub reserve: Pubkey,
    pub provider: Pubkey,
    pub amount_base: u64,
    pub shares: u64,
    pub equity_base: u64,
}

/// One per leg at open, so a reader can re-price the ticket from the prices the chain actually used.
#[event]
pub struct LegPriced {
    pub ticket: Pubkey,
    pub parlay_id: u64,
    pub leg_idx: u8,
    pub market: Pubkey,
    pub is_up: bool,
    pub price_raw: u64,
    pub expiry_sec: i64,
}

#[event]
pub struct ParlayOpened {
    pub reserve: Pubkey,
    pub ticket: Pubkey,
    pub owner: Pubkey,
    pub parlay_id: u64,
    pub leg_count: u8,
    pub stake_base: u64,
    pub max_payout_base: u64,
    pub combined_prob_raw: u64,
    pub last_expiry_sec: i64,
}

#[event]
pub struct LegResolved {
    pub ticket: Pubkey,
    pub parlay_id: u64,
    pub leg_idx: u8,
    pub market: Pubkey,
    pub outcome: LegStatus,
    pub cranker: Pubkey,
}

/// The ticket left the live book. `owed_base` is what its owner may now claim: the payout, the stake, or nothing.
#[event]
pub struct ParlaySettled {
    pub reserve: Pubkey,
    pub ticket: Pubkey,
    pub owner: Pubkey,
    pub parlay_id: u64,
    pub outcome: LegStatus,
    pub owed_base: u64,
}

#[event]
pub struct ParlayClaimed {
    pub reserve: Pubkey,
    pub ticket: Pubkey,
    pub owner: Pubkey,
    pub parlay_id: u64,
    pub paid_base: u64,
    pub cranker: Pubkey,
}
