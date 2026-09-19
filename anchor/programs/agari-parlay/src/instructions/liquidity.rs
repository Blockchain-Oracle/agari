use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{PROVIDER_SEED, RESERVE_SEED, VAULT_SEED};
use crate::errors::ParlayError;
use crate::events::{Supplied, Withdrawn};
use crate::state::{ParlayReserve, Provider};

#[derive(Accounts)]
pub struct Liquidity<'info> {
    #[account(mut)]
    pub provider: Signer<'info>,
    /// This wallet's own share balance. Created on first supply; never writable by anyone else.
    #[account(
        init_if_needed,
        payer = provider,
        space = 8 + Provider::INIT_SPACE,
        seeds = [PROVIDER_SEED, provider.key().as_ref()],
        bump,
    )]
    pub position: Account<'info, Provider>,
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump)]
    pub reserve: Box<Account<'info, ParlayReserve>>,
    #[account(mut, seeds = [VAULT_SEED], bump = reserve.vault_bump)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = collateral_mint, token::authority = provider)]
    pub provider_token: InterfaceAccount<'info, TokenAccount>,
    #[account(address = reserve.collateral_mint)]
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

/// Shares are priced against provider equity, which is the vault less what it owes ticket owners. Providers earn
/// the stakes of lost tickets and pay the winning streaks.
pub fn supply(ctx: Context<Liquidity>, amount_base: u64) -> Result<()> {
    require!(amount_base > 0, ParlayError::ZeroAmount);
    let reserve = &ctx.accounts.reserve;
    require!(!reserve.paused, ParlayError::Paused);

    let vault_balance = ctx.accounts.vault.amount;
    let shares = reserve.shares_for(vault_balance, amount_base)?;
    require!(shares > 0, ParlayError::ZeroAmount);
    let equity = reserve.equity_base(vault_balance);

    transfer_checked(
        CpiContext::new(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.provider_token.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
                to: ctx.accounts.vault.to_account_info(),
                authority: ctx.accounts.provider.to_account_info(),
            },
        ),
        amount_base,
        ctx.accounts.collateral_mint.decimals,
    )?;

    let reserve_key = ctx.accounts.reserve.key();
    let position = &mut ctx.accounts.position;
    position.reserve = reserve_key;
    position.owner = ctx.accounts.provider.key();
    position.bump = ctx.bumps.position;
    position.shares = position.shares.checked_add(shares).ok_or(ParlayError::MathOverflow)?;
    position.supplied_base = position.supplied_base.saturating_add(amount_base);

    let reserve = &mut ctx.accounts.reserve;
    reserve.supply_shares = reserve.supply_shares.checked_add(shares).ok_or(ParlayError::MathOverflow)?;
    emit!(Supplied {
        reserve: reserve_key,
        provider: ctx.accounts.provider.key(),
        amount_base,
        shares,
        equity_base: equity.saturating_add(amount_base),
    });
    Ok(())
}

/// A provider may take out their share of equity, but never capital that is backing a live ticket: what is
/// locked belongs to promises the reserve has already made. Withdrawing never pauses.
pub fn withdraw(ctx: Context<Liquidity>, shares: u64) -> Result<()> {
    require!(shares > 0, ParlayError::ZeroAmount);
    require!(shares <= ctx.accounts.position.shares, ParlayError::InsufficientShares);
    let reserve = &ctx.accounts.reserve;
    let vault_balance = ctx.accounts.vault.amount;
    let amount_base = reserve.amount_for(vault_balance, shares)?;
    let equity = reserve.equity_base(vault_balance);

    let seeds: &[&[u8]] = &[RESERVE_SEED, &[reserve.bump]];
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.vault.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
                to: ctx.accounts.provider_token.to_account_info(),
                authority: ctx.accounts.reserve.to_account_info(),
            },
            &[seeds],
        ),
        amount_base,
        ctx.accounts.collateral_mint.decimals,
    )?;

    let position = &mut ctx.accounts.position;
    position.shares = position.shares.checked_sub(shares).ok_or(ParlayError::MathOverflow)?;
    position.withdrawn_base = position.withdrawn_base.saturating_add(amount_base);

    let reserve = &mut ctx.accounts.reserve;
    reserve.supply_shares = reserve.supply_shares.checked_sub(shares).ok_or(ParlayError::MathOverflow)?;
    emit!(Withdrawn {
        reserve: reserve.key(),
        provider: ctx.accounts.provider.key(),
        amount_base,
        shares,
        equity_base: equity.saturating_sub(amount_base),
    });
    Ok(())
}
