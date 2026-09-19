use anchor_lang::prelude::*;

/// One wallet's share of the reserve. PDA `["provider", owner]`.
#[account]
#[derive(InitSpace)]
pub struct Provider {
    pub reserve: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    pub supplied_base: u64,
    pub withdrawn_base: u64,
    pub bump: u8,
}
