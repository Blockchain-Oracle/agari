use anchor_lang::prelude::*;
use anchor_spl::token::{transfer_checked, TransferChecked};
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{CUSTODY_SEED, PROVIDER_SEED, SEAT_SEED, VAULT_SEED};
use crate::errors::MakerError;
use crate::events::{Supplied, Withdrawn};
use crate::state::{MakerVault, Provider};

#[derive(Accounts)]
pub struct Liquidity<'info> {
    #[account(mut)]
    pub provider: Signer<'info>,
    #[account(
        init_if_needed,
        payer = provider,
        space = 8 + Provider::INIT_SPACE,
        seeds = [PROVIDER_SEED, provider.key().as_ref()],
        bump,
    )]
    pub position: Account<'info, Provider>,
    #[account(mut, seeds = [VAULT_SEED], bump = vault.bump)]
    pub vault: Account<'info, MakerVault>,
    #[account(mut, seeds = [CUSTODY_SEED], bump = vault.custody_bump)]
    pub custody: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: custody's authority; it signs withdrawals out.
    #[account(seeds = [SEAT_SEED], bump = vault.seat_bump)]
    pub seat: UncheckedAccount<'info>,
    #[account(mut, token::mint = collateral_mint, token::authority = provider)]
    pub provider_token: InterfaceAccount<'info, TokenAccount>,
    #[account(address = vault.collateral_mint)]
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

/// Shares are priced against total value — idle custody plus what the venue holds — so the price does not move
/// when the maker quotes, only when a Window settles for or against the vault.
pub fn supply(ctx: Context<Liquidity>, amount_base: u64) -> Result<()> {
    require!(amount_base > 0, MakerError::ZeroAmount);
    require!(!ctx.accounts.vault.paused, MakerError::Paused);

    let total = ctx.accounts.vault.total_value_base(ctx.accounts.custody.amount);
    let shares = if ctx.accounts.vault.supply_shares == 0 || total == 0 {
        amount_base
    } else {
        u64::try_from((u128::from(amount_base) * u128::from(ctx.accounts.vault.supply_shares)) / u128::from(total))
            .map_err(|_| MakerError::MathOverflow)?
    };
    require!(shares > 0, MakerError::ZeroAmount);

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

    let vault_key = ctx.accounts.vault.key();
    let position = &mut ctx.accounts.position;
    position.vault = vault_key;
    position.owner = ctx.accounts.provider.key();
    position.bump = ctx.bumps.position;
    position.shares = position.shares.checked_add(shares).ok_or(MakerError::MathOverflow)?;
    position.supplied_base = position.supplied_base.saturating_add(amount_base);

    let vault = &mut ctx.accounts.vault;
    vault.supply_shares = vault.supply_shares.checked_add(shares).ok_or(MakerError::MathOverflow)?;
    emit!(Supplied {
        vault: vault_key,
        provider: position.owner,
        amount_base,
        shares,
        total_value_base: total.saturating_add(amount_base),
    });
    Ok(())
}

/// A provider redeems their share of total value, but only out of idle custody: capital the venue is holding
/// against live quotes is not there to be taken. Pull the quotes first and it becomes idle.
pub fn withdraw(ctx: Context<Liquidity>, shares: u64) -> Result<()> {
    require!(shares > 0, MakerError::ZeroAmount);
    require!(shares <= ctx.accounts.position.shares, MakerError::InsufficientShares);
    let vault_key = ctx.accounts.vault.key();
    let supply = ctx.accounts.vault.supply_shares;
    require!(supply > 0, MakerError::NoValue);

    let custody_balance = ctx.accounts.custody.amount;
    let total = ctx.accounts.vault.total_value_base(custody_balance);
    require!(total > 0, MakerError::NoValue);
    let amount_base = u64::try_from((u128::from(shares) * u128::from(total)) / u128::from(supply))
        .map_err(|_| MakerError::MathOverflow)?;
    require!(amount_base > 0, MakerError::ZeroAmount);
    require!(amount_base <= custody_balance, MakerError::InsufficientLiquidity);

    let bump = [ctx.accounts.vault.seat_bump];
    let seeds: &[&[u8]] = &[SEAT_SEED, &bump];
    transfer_checked(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.key(),
            TransferChecked {
                from: ctx.accounts.custody.to_account_info(),
                mint: ctx.accounts.collateral_mint.to_account_info(),
                to: ctx.accounts.provider_token.to_account_info(),
                authority: ctx.accounts.seat.to_account_info(),
            },
            &[seeds],
        ),
        amount_base,
        ctx.accounts.collateral_mint.decimals,
    )?;

    let position = &mut ctx.accounts.position;
    position.shares = position.shares.checked_sub(shares).ok_or(MakerError::MathOverflow)?;
    position.withdrawn_base = position.withdrawn_base.saturating_add(amount_base);
    let owner = position.owner;

    let vault = &mut ctx.accounts.vault;
    vault.supply_shares = supply.checked_sub(shares).ok_or(MakerError::MathOverflow)?;
    emit!(Withdrawn {
        vault: vault_key,
        provider: owner,
        amount_base,
        shares,
        total_value_base: total.saturating_sub(amount_base),
    });
    Ok(())
}
