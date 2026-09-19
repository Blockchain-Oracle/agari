use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{PROVIDER_SEED, RESERVE_SEED, VAULT_SEED};
use crate::errors::RangeError;
use crate::events::{Supplied, Withdrawn};
use crate::state::{Provider, Reserve};

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
    pub reserve: Account<'info, Reserve>,
    #[account(mut, seeds = [VAULT_SEED], bump = reserve.vault_bump)]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    #[account(mut, token::mint = collateral_mint, token::authority = provider)]
    pub provider_token: InterfaceAccount<'info, TokenAccount>,
    #[account(address = reserve.collateral_mint)]
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

/// Shares are priced against provider equity, which is the vault less what it owes round owners. The first
/// supply mints one share per unit so the price starts at one and only ever moves with the reserve's results.
pub fn supply(ctx: Context<Liquidity>, amount_base: u64) -> Result<()> {
    require!(amount_base > 0, RangeError::ZeroAmount);
    let reserve = &ctx.accounts.reserve;
    require!(!reserve.paused, RangeError::Paused);

    let equity = reserve.equity_base(ctx.accounts.vault.amount);
    let shares = if reserve.supply_shares == 0 || equity == 0 {
        amount_base
    } else {
        u64::try_from((u128::from(amount_base) * u128::from(reserve.supply_shares)) / u128::from(equity))
            .map_err(|_| RangeError::MathOverflow)?
    };
    require!(shares > 0, RangeError::ZeroAmount);

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
    position.shares = position.shares.checked_add(shares).ok_or(RangeError::MathOverflow)?;
    position.supplied_base = position.supplied_base.saturating_add(amount_base);

    let reserve = &mut ctx.accounts.reserve;
    reserve.supply_shares = reserve.supply_shares.checked_add(shares).ok_or(RangeError::MathOverflow)?;
    emit!(Supplied {
        reserve: reserve.key(),
        provider: ctx.accounts.provider.key(),
        amount_base,
        shares,
        equity_base: equity.saturating_add(amount_base),
    });
    Ok(())
}

/// A provider may take out their share of equity, but never capital that is backing a live round: what is
/// locked belongs to promises the reserve has already made.
pub fn withdraw(ctx: Context<Liquidity>, shares: u64) -> Result<()> {
    require!(shares > 0, RangeError::ZeroAmount);
    let reserve = &ctx.accounts.reserve;
    require!(shares <= ctx.accounts.position.shares, RangeError::InsufficientShares);
    require!(shares <= reserve.supply_shares, RangeError::InsufficientShares);

    let vault_balance = ctx.accounts.vault.amount;
    let equity = reserve.equity_base(vault_balance);
    require!(equity > 0 && reserve.supply_shares > 0, RangeError::NoEquity);

    let amount_base = u64::try_from((u128::from(shares) * u128::from(equity)) / u128::from(reserve.supply_shares))
        .map_err(|_| RangeError::MathOverflow)?;
    require!(amount_base > 0, RangeError::ZeroAmount);
    require!(amount_base <= reserve.free_base(vault_balance), RangeError::InsufficientLiquidity);

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
    position.shares = position.shares.checked_sub(shares).ok_or(RangeError::MathOverflow)?;
    position.withdrawn_base = position.withdrawn_base.saturating_add(amount_base);

    let reserve = &mut ctx.accounts.reserve;
    reserve.supply_shares = reserve.supply_shares.checked_sub(shares).ok_or(RangeError::MathOverflow)?;
    emit!(Withdrawn {
        reserve: reserve.key(),
        provider: ctx.accounts.provider.key(),
        amount_base,
        shares,
        equity_base: equity.saturating_sub(amount_base),
    });
    Ok(())
}
