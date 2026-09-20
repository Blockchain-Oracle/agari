use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{CUSTODY_SEED, PROVIDER_SEED, RESERVE_SEED, SEAT_SEED};
use crate::errors::LeverageError;
use crate::events::{Supplied, Withdrawn};
use crate::instructions::payout::Payer;
use crate::state::{LeverageReserve, Provider};

#[derive(Accounts)]
pub struct Liquidity<'info> {
    #[account(mut)]
    pub provider: Signer<'info>,
    /// This wallet's own share balance. Created on first supply; never writable by anyone else.
    #[account(init_if_needed, payer = provider, space = 8 + Provider::INIT_SPACE, seeds = [PROVIDER_SEED, provider.key().as_ref()], bump)]
    pub record: Account<'info, Provider>,
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump)]
    pub reserve: Box<Account<'info, LeverageReserve>>,
    #[account(mut, seeds = [CUSTODY_SEED], bump = reserve.custody_bump)]
    pub custody: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: the reserve's seat, which is custody's authority.
    #[account(seeds = [SEAT_SEED], bump = reserve.seat_bump)]
    pub seat: UncheckedAccount<'info>,
    #[account(mut, token::mint = collateral_mint, token::authority = provider)]
    pub provider_token: InterfaceAccount<'info, TokenAccount>,
    #[account(address = reserve.collateral_mint @ LeverageError::WrongCollateral)]
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

/// Capital for the reserve, as shares of its total value. Providers keep the premiums and carry the gap between
/// the knock-out line and what the book actually pays.
pub fn supply(ctx: Context<Liquidity>, amount_base: u64) -> Result<()> {
    require!(amount_base > 0, LeverageError::ZeroAmount);
    require!(!ctx.accounts.reserve.paused, LeverageError::Paused);
    let custody_balance = ctx.accounts.custody.amount;
    let shares = ctx.accounts.reserve.shares_for(custody_balance, amount_base)?;
    require!(shares > 0, LeverageError::ZeroAmount);
    let total_before = ctx.accounts.reserve.total_value_base(custody_balance);

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.provider_token.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
                to: ctx.accounts.custody.to_account_info(),
                authority: ctx.accounts.provider.to_account_info(),
            },
        ),
        amount_base,
        ctx.accounts.collateral_mint.decimals,
    )?;

    let provider = ctx.accounts.provider.key();
    let record = &mut ctx.accounts.record;
    record.owner = provider;
    record.bump = ctx.bumps.record;
    record.shares = record.shares.checked_add(shares).ok_or(LeverageError::MathOverflow)?;
    record.supplied_base = record.supplied_base.saturating_add(amount_base);
    let reserve = &mut ctx.accounts.reserve;
    reserve.supply_shares = reserve.supply_shares.checked_add(shares).ok_or(LeverageError::MathOverflow)?;
    emit!(Supplied { provider, amount_base, shares, total_value_base: total_before.saturating_add(amount_base) });
    Ok(())
}

/// Redeems shares for their part of the total value, from liquid capital only. Refused while a position past its
/// Window's expiry is unsettled: settle it first, which anyone may. Withdrawing never pauses.
pub fn withdraw(ctx: Context<Liquidity>, shares: u64) -> Result<()> {
    require!(shares > 0, LeverageError::ZeroAmount);
    require!(shares <= ctx.accounts.record.shares, LeverageError::InsufficientShares);
    let now = Clock::get()?.unix_timestamp;
    let custody_balance = ctx.accounts.custody.amount;
    let amount_base = ctx.accounts.reserve.amount_for(custody_balance, shares, now)?;
    let total_before = ctx.accounts.reserve.total_value_base(custody_balance);

    let payer = Payer {
        custody: &ctx.accounts.custody,
        seat: &ctx.accounts.seat.to_account_info(),
        mint: &ctx.accounts.collateral_mint,
        token_program: &ctx.accounts.token_program.to_account_info(),
        seat_bump: ctx.accounts.reserve.seat_bump,
    };
    payer.pay(&ctx.accounts.provider_token.to_account_info(), amount_base)?;

    let provider = ctx.accounts.provider.key();
    let record = &mut ctx.accounts.record;
    record.shares -= shares;
    record.withdrawn_base = record.withdrawn_base.saturating_add(amount_base);
    let reserve = &mut ctx.accounts.reserve;
    reserve.supply_shares = reserve.supply_shares.checked_sub(shares).ok_or(LeverageError::MathOverflow)?;
    emit!(Withdrawn { provider, amount_base, shares, total_value_base: total_before.saturating_sub(amount_base) });
    Ok(())
}
