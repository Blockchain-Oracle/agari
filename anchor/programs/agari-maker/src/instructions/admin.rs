use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{CUSTODY_SEED, SEAT_SEED, VAULT_SEED};
use crate::errors::MakerError;
use crate::events::{ParamsUpdated, VaultInitialized};
use crate::state::{MakerParams, MakerVault};

#[derive(Accounts)]
pub struct AdminInitVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + MakerVault::INIT_SPACE, seeds = [VAULT_SEED], bump)]
    pub vault: Account<'info, MakerVault>,
    /// CHECK: the vault's engine seat. It signs every CPI, so custody is held in its name and nobody else's.
    #[account(seeds = [SEAT_SEED], bump)]
    pub seat: UncheckedAccount<'info>,
    /// Idle collateral. Its authority is the seat, because the engine moves it as the seat.
    #[account(
        init,
        payer = admin,
        seeds = [CUSTODY_SEED],
        bump,
        token::mint = collateral_mint,
        token::authority = seat,
    )]
    pub custody: InterfaceAccount<'info, TokenAccount>,
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    /// CHECK: recorded as the only engine this vault will quote on.
    pub events_program: UncheckedAccount<'info>,
    /// CHECK: the venue's GlobalConfig, recorded so a quote cannot be pointed at another venue.
    pub venue_config: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn admin_init_vault(ctx: Context<AdminInitVault>, maker: Pubkey, params: MakerParams) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.admin = ctx.accounts.admin.key();
    vault.maker = maker;
    vault.collateral_mint = ctx.accounts.collateral_mint.key();
    vault.events_program = ctx.accounts.events_program.key();
    vault.venue_config = ctx.accounts.venue_config.key();
    vault.params = params;
    vault.deployed_base = 0;
    vault.supply_shares = 0;
    vault.open_windows = 0;
    vault.paused = false;
    vault.bump = ctx.bumps.vault;
    vault.custody_bump = ctx.bumps.custody;
    vault.seat_bump = ctx.bumps.seat;

    emit!(VaultInitialized {
        vault: vault.key(),
        admin: vault.admin,
        maker,
        collateral_mint: vault.collateral_mint,
        seat: ctx.accounts.seat.key(),
    });
    Ok(())
}

#[derive(Accounts)]
pub struct AdminSetParams<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [VAULT_SEED], bump = vault.bump, has_one = admin @ MakerError::NotMaker)]
    pub vault: Account<'info, MakerVault>,
}

/// Params bind the next quote, never one already resting. Pausing stops new quotes; pulling and settling stay
/// open, because a paused vault must still be able to get its capital back.
pub fn admin_set_params(ctx: Context<AdminSetParams>, maker: Pubkey, params: MakerParams, paused: bool) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    vault.maker = maker;
    vault.params = params;
    vault.paused = paused;
    emit!(ParamsUpdated { vault: vault.key(), maker, paused });
    Ok(())
}
