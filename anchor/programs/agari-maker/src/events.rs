use anchor_lang::prelude::*;

#[event]
pub struct VaultInitialized {
    pub vault: Pubkey,
    pub admin: Pubkey,
    pub maker: Pubkey,
    pub collateral_mint: Pubkey,
    pub seat: Pubkey,
}

#[event]
pub struct ParamsUpdated {
    pub vault: Pubkey,
    pub maker: Pubkey,
    pub paused: bool,
}

#[event]
pub struct Supplied {
    pub vault: Pubkey,
    pub provider: Pubkey,
    pub amount_base: u64,
    pub shares: u64,
    pub total_value_base: u64,
}

#[event]
pub struct Withdrawn {
    pub vault: Pubkey,
    pub provider: Pubkey,
    pub amount_base: u64,
    pub shares: u64,
    pub total_value_base: u64,
}

/// One two-sided quote, with what the engine actually took for it.
#[event]
pub struct Quoted {
    pub vault: Pubkey,
    pub market: Pubkey,
    pub bid_ticks: u16,
    pub ask_ticks: u16,
    pub lots: u64,
    pub escrow_out_base: u64,
    pub deployed_base: u64,
}

#[event]
pub struct Pulled {
    pub vault: Pubkey,
    pub market: Pubkey,
    pub escrow_back_base: u64,
}

#[event]
pub struct Merged {
    pub vault: Pubkey,
    pub market: Pubkey,
    pub lots: u64,
    pub merged_base: u64,
}

#[event]
pub struct WindowSettled {
    pub vault: Pubkey,
    pub market: Pubkey,
    pub payout_base: u64,
    pub realized_base: i64,
}
