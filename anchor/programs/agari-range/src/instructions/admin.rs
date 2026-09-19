use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::constants::{RESERVE_SEED, VAULT_SEED};
use crate::errors::RangeError;
use crate::events::{ParamsUpdated, ReserveInitialized};
use crate::state::{RangeParams, Reserve};

#[derive(Accounts)]
pub struct AdminInitReserve<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Reserve::INIT_SPACE, seeds = [RESERVE_SEED], bump)]
    pub reserve: Account<'info, Reserve>,
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    /// The reserve's own custody. Collateral leaves it only to a round's owner or a provider (AD-5).
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

pub fn admin_init_reserve(ctx: Context<AdminInitReserve>, params: RangeParams) -> Result<()> {
    let reserve = &mut ctx.accounts.reserve;
    reserve.admin = ctx.accounts.admin.key();
    reserve.collateral_mint = ctx.accounts.collateral_mint.key();
    reserve.events_program = ctx.accounts.events_program.key();
    reserve.params = params;
    reserve.user_escrow_base = 0;
    reserve.locked_base = 0;
    reserve.supply_shares = 0;
    reserve.next_round_id = 1;
    reserve.rounds_open = 0;
    reserve.paused = false;
    reserve.bump = ctx.bumps.reserve;
    reserve.vault_bump = ctx.bumps.vault;

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
    #[account(mut, seeds = [RESERVE_SEED], bump = reserve.bump, has_one = admin @ RangeError::WrongEngine)]
    pub reserve: Account<'info, Reserve>,
}

/// Params bind the next round, never one already open: every round froze its own price at its open.
pub fn admin_set_params(ctx: Context<AdminSetParams>, params: RangeParams, paused: bool) -> Result<()> {
    let reserve = &mut ctx.accounts.reserve;
    reserve.params = params;
    reserve.paused = paused;
    emit!(ParamsUpdated { reserve: reserve.key(), paused });
    Ok(())
}
