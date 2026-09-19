use anchor_lang::prelude::*;

/// One provider's claim on the vault. Shares move only under this wallet's own signature.
#[account]
#[derive(InitSpace)]
pub struct Provider {
    pub vault: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    pub supplied_base: u64,
    pub withdrawn_base: u64,
    pub bump: u8,
}
