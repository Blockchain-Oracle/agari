use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{EXPIRY_SLOTS, RESERVE_SEED, VAULT_SEED};
use crate::errors::ParlayError;
use crate::events::{ParamsUpdated, ReserveInitialized};
use crate::state::{ExpiryLock, ParlayParams, ParlayReserve};

#[derive(Accounts)]
pub struct AdminInitReserve<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + ParlayReserve::INIT_SPACE, seeds = [RESERVE_SEED], bump)]
    pub reserve: Box<Account<'info, ParlayReserve>>,
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    /// The reserve's own custody. Collateral leaves it only to a ticket's owner or a provider (AD-5).
    #[account(
        init,
        payer = admin,
        seeds = [VAULT_SEED],
        bump,
        token::mint = collateral_mint,
        token::authority = reserve,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: recorded as the only engine whose Windows this reserve will price.
    pub events_program: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn admin_init_reserve(ctx: Context<AdminInitReserve>, params: ParlayParams) -> Result<()> {
    params.validate()?;
    let reserve = &mut ctx.accounts.reserve;
    reserve.admin = ctx.accounts.admin.key();
    reserve.collateral_mint = ctx.accounts.collateral_mint.key();
    reserve.events_program = ctx.accounts.events_program.key();
    reserve.params = params;
    reserve.user_escrow_base = 0;
    reserve.locked_base = 0;
    reserve.supply_shares = 0;
    // 1-based, as the reference counts them: 0 means "none".
    reserve.next_parlay_id = 1;
    reserve.tickets_open = 0;
    reserve.paused = false;
    reserve.bump = ctx.bumps.reserve;
    reserve.vault_bump = ctx.bumps.vault;
    reserve.expiry_locks = [ExpiryLock::default(); EXPIRY_SLOTS];

    emit!(ReserveInitialized {
        reserve: reserve.key(),
        admin: reserve.admin,
        collateral_mint: reserve.collateral_mint,
    });
    Ok(())
}

#[derive(Accounts)]
pub struct AdminSetParams<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump, has_one = admin @ ParlayError::NotAdmin)]
    pub reserve: Box<Account<'info, ParlayReserve>>,
}

/// Tunables only, and the pause. Params bind the next ticket, never one already open: every ticket froze its own
/// price at its open. The pause stops new tickets and new supply; resolving, claiming and withdrawing never pause.
pub fn admin_set_params(ctx: Context<AdminSetParams>, params: ParlayParams, paused: bool) -> Result<()> {
    params.validate()?;
    let reserve = &mut ctx.accounts.reserve;
    reserve.params = params;
    reserve.paused = paused;
    emit!(ParamsUpdated { reserve: reserve.key(), paused });
    Ok(())
}
