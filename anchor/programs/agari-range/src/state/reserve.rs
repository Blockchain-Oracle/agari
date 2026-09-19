use anchor_lang::prelude::*;

/// The reserve's balance sheet lands with the instruction set.
#[account]
#[derive(InitSpace)]
pub struct Reserve {
    pub admin: Pubkey,
    pub bump: u8,
}
