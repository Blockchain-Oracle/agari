//! Collateral moves (AD-5): into custody from a token account the owner signs for, and out of custody only to the
//! owner's associated token account, signed by the seat PDA. No other destination exists in the program.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, TransferChecked};

use crate::constants::SEAT_SEED;

/// The accounts a transfer touches.
pub struct Collateral<'a, 'info> {
    pub token_program: &'a AccountInfo<'info>,
    pub mint: &'a AccountInfo<'info>,
    pub custody: &'a AccountInfo<'info>,
    pub decimals: u8,
}

impl<'info> Collateral<'_, 'info> {
    /// `transfer_checked(owner_token → custody)`, signed by the owner.
    pub fn pull(&self, owner: &AccountInfo<'info>, owner_token: &AccountInfo<'info>, amount: u64) -> Result<()> {
        let accounts = TransferChecked { from: owner_token.clone(), mint: self.mint.clone(), to: self.custody.clone(), authority: owner.clone() };
        token::transfer_checked(CpiContext::new(self.token_program.key(), accounts), amount, self.decimals)
    }

    /// `transfer_checked(custody → owner_ata)`, signed by the seat PDA. Callers check `owner_ata` first.
    pub fn pay(&self, seat: &AccountInfo<'info>, seat_bump: u8, owner_ata: &AccountInfo<'info>, amount: u64) -> Result<()> {
        let bump = [seat_bump];
        let seeds: &[&[u8]] = &[SEAT_SEED, &bump];
        let signer = &[seeds];
        let accounts = TransferChecked { from: self.custody.clone(), mint: self.mint.clone(), to: owner_ata.clone(), authority: seat.clone() };
        token::transfer_checked(CpiContext::new_with_signer(self.token_program.key(), accounts, signer), amount, self.decimals)
    }
}
