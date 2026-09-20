//! The owner's own instructions. Each one is signed by the owner, touches only the owner's Budget, and the one that
//! pays out pays the signer and nobody else. None of them needs anything from the desk.

use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{BUDGET_SEED, CUSTODY_SEED, DESK_SEED, SEAT_SEED};
use crate::errors::PrivateError;
use crate::events::{Allowed, Deposited, Withdrawn};
use crate::instructions::payout::Payer;
use crate::state::{Budget, Desk};

#[derive(Accounts)]
pub struct OwnerFunds<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(mut, seeds = [DESK_SEED], bump = desk_account.bump)]
    pub desk_account: Box<Account<'info, Desk>>,
    #[account(init_if_needed, payer = owner, space = 8 + Budget::INIT_SPACE, seeds = [BUDGET_SEED, owner.key().as_ref()], bump)]
    pub budget: Box<Account<'info, Budget>>,
    #[account(mut, seeds = [CUSTODY_SEED], bump = desk_account.custody_bump)]
    pub custody: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: the desk's seat, which is custody's authority.
    #[account(seeds = [SEAT_SEED], bump = desk_account.seat_bump)]
    pub seat: UncheckedAccount<'info>,
    #[account(mut, token::mint = collateral_mint, token::authority = owner)]
    pub owner_token: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(address = desk_account.collateral_mint @ PrivateError::WrongCollateral)]
    pub collateral_mint: Box<InterfaceAccount<'info, Mint>>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

fn claim_budget(budget: &mut Budget, owner: Pubkey, bump: u8) {
    budget.owner = owner;
    budget.bump = bump;
}

/// Top up and authorise in one transaction, so no state exists where the money is in but the desk cannot touch it.
/// A zero amount is a plain re-allow.
pub fn owner_deposit_and_allow(ctx: Context<OwnerFunds>, amount_base: u64, allowance_base: u64) -> Result<()> {
    let owner = ctx.accounts.owner.key();
    claim_budget(&mut ctx.accounts.budget, owner, ctx.bumps.budget);
    if amount_base != 0 {
        let a = &mut *ctx.accounts;
        transfer_checked(
            CpiContext::new(
                a.token_program.key(),
                TransferChecked { from: a.owner_token.to_account_info(), mint: a.collateral_mint.to_account_info(), to: a.custody.to_account_info(), authority: a.owner.to_account_info() },
            ),
            amount_base,
            a.collateral_mint.decimals,
        )?;
        a.desk_account.book_deposit(&mut a.budget, amount_base)?;
        emit!(Deposited { owner, amount_base, balance_base: a.budget.balance_base });
    }
    ctx.accounts.budget.allowance_base = allowance_base;
    emit!(Allowed { owner, allowance_base });
    Ok(())
}

/// Take it back. Pays the signer and nobody else; needs no cooperation from the desk, and no pause can stop it.
pub fn owner_withdraw(ctx: Context<OwnerFunds>, amount_base: u64) -> Result<()> {
    let owner = ctx.accounts.owner.key();
    claim_budget(&mut ctx.accounts.budget, owner, ctx.bumps.budget);
    let a = &mut *ctx.accounts;
    // The books are closed before the money moves.
    a.desk_account.book_withdraw(&mut a.budget, amount_base)?;
    let payer = Payer { custody: &a.custody, seat: &a.seat.to_account_info(), mint: &a.collateral_mint, token_program: &a.token_program.to_account_info(), seat_bump: a.desk_account.seat_bump };
    payer.pay(&a.owner_token.to_account_info(), amount_base)?;
    emit!(Withdrawn { owner, amount_base, balance_base: a.budget.balance_base });
    Ok(())
}

#[derive(Accounts)]
pub struct OwnerAllow<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,
    #[account(init_if_needed, payer = owner, space = 8 + Budget::INIT_SPACE, seeds = [BUDGET_SEED, owner.key().as_ref()], bump)]
    pub budget: Box<Account<'info, Budget>>,
    pub system_program: Program<'info, System>,
}

/// What the desk may still spend of the balance. Zero refuses every private bet.
pub fn owner_allow(ctx: Context<OwnerAllow>, allowance_base: u64) -> Result<()> {
    let owner = ctx.accounts.owner.key();
    claim_budget(&mut ctx.accounts.budget, owner, ctx.bumps.budget);
    ctx.accounts.budget.allowance_base = allowance_base;
    emit!(Allowed { owner, allowance_base });
    Ok(())
}

/// Cancel the desk's permission outright, leaving the balance untouched.
pub fn owner_revoke(ctx: Context<OwnerAllow>) -> Result<()> {
    owner_allow(ctx, 0)
}
