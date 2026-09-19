use anchor_lang::prelude::*;

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

/// Everything a reader needs to re-price the round themselves: the basis, the band and what it cost.
#[event]
pub struct RoundOpened {
    pub reserve: Pubkey,
    pub round: Pubkey,
    pub owner: Pubkey,
    pub market: Pubkey,
    pub round_id: u64,
    pub is_inside: bool,
    pub opening_print: i64,
    pub low_print: i64,
    pub high_print: i64,
    pub center_q_e6: u32,
    pub sigma_e8: u64,
    pub tau_sec: u32,
    pub prob_raw: u64,
    pub stake_base: u64,
    pub max_payout_base: u64,
}

#[event]
pub struct RoundSettled {
    pub reserve: Pubkey,
    pub round: Pubkey,
    pub round_id: u64,
    pub closing_print: i64,
    pub won: bool,
    pub payout_base: u64,
}

#[event]
pub struct RoundVoided {
    pub reserve: Pubkey,
    pub round: Pubkey,
    pub round_id: u64,
    pub refund_base: u64,
}

#[event]
pub struct RoundClaimed {
    pub reserve: Pubkey,
    pub round: Pubkey,
    pub round_id: u64,
    pub owner: Pubkey,
    pub payout_base: u64,
}
