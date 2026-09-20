//! Moving collateral out of custody, which only the seat can do, and the rule that an exit never waits on the
//! owner's token account.

use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount};

use crate::constants::SEAT_SEED;
use crate::state::{LeverageReserve, Position};

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

/// Pays the owner's part of an exit now when their token account was passed, and otherwise leaves it owed.
///
/// A knock-out and a settlement are permissionless and they pay the owner. If they needed the owner's token account
/// to exist, an owner could close it and make their own position impossible to knock out. So it is optional: present,
/// they are paid in this transaction; absent, the money waits in custody under `owed_base` for `public_claim`.
/// Returns what was left owed.
pub fn pay_or_owe<'info>(
    payer: &Payer<'_, 'info>,
    reserve: &mut LeverageReserve,
    position: &mut Position,
    owner_token: Option<&InterfaceAccount<'info, TokenAccount>>,
    amount_base: u64,
) -> Result<u64> {
    if amount_base == 0 {
        return Ok(0);
    }
    match owner_token {
        Some(token) => {
            payer.pay(&token.to_account_info(), amount_base)?;
            Ok(0)
        }
        None => {
            reserve.book_owed(position, amount_base)?;
            Ok(amount_base)
        }
    }
}
