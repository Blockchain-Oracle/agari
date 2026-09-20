//! Moving collateral out of custody, which only the seat can do.

use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::constants::SEAT_SEED;

pub struct Payer<'a, 'info> {
    pub custody: &'a InterfaceAccount<'info, TokenAccount>,
    pub seat: &'a AccountInfo<'info>,
    pub mint: &'a InterfaceAccount<'info, Mint>,
    pub token_program: &'a AccountInfo<'info>,
    pub seat_bump: u8,
}

impl<'info> Payer<'_, 'info> {
    /// Custody is held in the seat's name, so the seat signs.
    pub fn pay(&self, to: &AccountInfo<'info>, amount_base: u64) -> Result<()> {
        if amount_base == 0 {
            return Ok(());
        }
        let bump = [self.seat_bump];
        let seeds: &[&[u8]] = &[SEAT_SEED, &bump];
        transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.key(),
                TransferChecked { from: self.custody.to_account_info(), mint: self.mint.to_account_info(), to: to.clone(), authority: self.seat.clone() },
                &[seeds],
            ),
            amount_base,
            self.mint.decimals,
        )
    }
}
