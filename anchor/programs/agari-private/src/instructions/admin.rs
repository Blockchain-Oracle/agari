use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use agari_common::view::load_checked;
use agari_events::state::GlobalConfig;

use crate::constants::{CUSTODY_SEED, DESK_SEED, EVENTS_CONFIG, SEAT_SEED};
use crate::errors::PrivateError;
use crate::events::{DeskChanged, DeskInitialized, ParamsUpdated, PausedSet};
use crate::program::AgariPrivate;
use crate::state::{Desk, PrivateParams};

#[derive(Accounts)]
pub struct AdminInitDesk<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Desk::INIT_SPACE, seeds = [DESK_SEED], bump)]
    pub desk_account: Box<Account<'info, Desk>>,
    /// CHECK: the desk's engine seat. It signs every CPI, so custody is held in its name and nobody else's.
    #[account(seeds = [SEAT_SEED], bump)]
    pub seat: UncheckedAccount<'info>,
    /// Every unit the desk holds: balances, the pool's float and every slot's cash.
    #[account(init, payer = admin, seeds = [CUSTODY_SEED], bump, token::mint = collateral_mint, token::authority = seat)]
    pub custody: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: the venue's config, at its own address; its collateral has to be this desk's.
    #[account(address = EVENTS_CONFIG @ PrivateError::UnknownMarket)]
    pub events_config: UncheckedAccount<'info>,
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub program: Program<'info, AgariPrivate>,
    /// CHECK: this program's ProgramData, matched against `program` below.
    pub program_data: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

fn upgrade_authority(program: &Program<AgariPrivate>, program_data: &UncheckedAccount) -> Option<Pubkey> {
    if program.programdata_address().ok()?? != program_data.key() || *program_data.owner != anchor_lang::solana_program::bpf_loader_upgradeable::ID {
        return None;
    }
    let data = program_data.try_borrow_data().ok()?;
    ProgramData::try_deserialize(&mut &data[..]).ok()?.upgrade_authority_address
}

/// Only the program's upgrade authority can initialise it. Without that, whoever saw the deploy first could name
/// their own desk key and spend every allowance set afterwards.
pub fn admin_init_desk(ctx: Context<AdminInitDesk>, desk: Pubkey, params: PrivateParams) -> Result<()> {
    let a = &ctx.accounts;
    require!(upgrade_authority(&a.program, &a.program_data) == Some(a.admin.key()), PrivateError::NotAdmin);
    require!(desk != Pubkey::default(), PrivateError::NotDesk);
    params.validate()?;
    {
        let venue = load_checked::<GlobalConfig>(&a.events_config, &agari_events::ID)?;
        require_keys_eq!(a.collateral_mint.key(), venue.collateral_mint, PrivateError::WrongCollateral);
    }

    let (admin, mint, seat) = (a.admin.key(), a.collateral_mint.key(), a.seat.key());
    let d = &mut ctx.accounts.desk_account;
    d.admin = admin;
    d.desk = desk;
    d.collateral_mint = mint;
    d.params = params;
    d.pool_base = 0;
    d.owed_base = 0;
    d.in_slots_base = 0;
    d.paused = false;
    d.bump = ctx.bumps.desk_account;
    d.seat_bump = ctx.bumps.seat;
    d.custody_bump = ctx.bumps.custody;

    emit!(DeskInitialized { desk_account: d.key(), admin, desk, collateral_mint: mint, seat });
    Ok(())
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [DESK_SEED], bump = desk_account.bump, has_one = admin @ PrivateError::NotAdmin)]
    pub desk_account: Box<Account<'info, Desk>>,
}

/// Rotates the desk key. Allowances stay as the owners set them, so an owner who does not trust the new key revokes.
pub fn admin_set_desk(ctx: Context<AdminOnly>, desk: Pubkey) -> Result<()> {
    require!(desk != Pubkey::default(), PrivateError::NotDesk);
    ctx.accounts.desk_account.desk = desk;
    emit!(DeskChanged { desk });
    Ok(())
}

pub fn admin_set_params(ctx: Context<AdminOnly>, params: PrivateParams) -> Result<()> {
    params.validate()?;
    ctx.accounts.desk_account.params = params;
    emit!(ParamsUpdated { params });
    Ok(())
}

/// Stops new charges and new mints. It never stops a withdrawal, a settlement, a sweep or a credit.
pub fn admin_set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
    ctx.accounts.desk_account.paused = paused;
    emit!(PausedSet { paused });
    Ok(())
}
