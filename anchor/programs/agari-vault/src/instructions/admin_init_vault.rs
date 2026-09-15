//! `admin_init_vault()` (vault.md §3.1).

use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use core::mem::size_of;

use agari_common::view::load_checked;
use agari_events::state::GlobalConfig;

use crate::constants::{EVENTS_CONFIG, SEAT_SEED, VAULT_CONFIG_SEED};
use crate::errors::VaultError;
use crate::events::VaultInitialized;
use crate::program::AgariVault;
use crate::state::VaultConfig;

#[derive(Accounts)]
pub struct AdminInitVault<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + size_of::<VaultConfig>(), seeds = [VAULT_CONFIG_SEED], bump)]
    pub vault_config: AccountLoader<'info, VaultConfig>,
    /// CHECK: the `["seat"]` PDA (no data); only its address and bump are recorded.
    #[account(seeds = [SEAT_SEED], bump)]
    pub seat: UncheckedAccount<'info>,
    /// CHECK: agari-events' GlobalConfig, read with `load_checked` in the handler.
    #[account(address = EVENTS_CONFIG)]
    pub events_config: UncheckedAccount<'info>,
    pub collateral_mint: Box<Account<'info, Mint>>,
    pub program: Program<'info, AgariVault>,
    /// CHECK: this program's ProgramData, whose upgrade authority must be `admin` (checked in the handler).
    pub program_data: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

/// The upgrade authority recorded in this program's ProgramData, if `program_data` really is it.
fn upgrade_authority(program: &Program<AgariVault>, program_data: &UncheckedAccount) -> Option<Pubkey> {
    if program.programdata_address().ok()?? != program_data.key() || *program_data.owner != anchor_lang::solana_program::bpf_loader_upgradeable::ID {
        return None;
    }
    let data = program_data.try_borrow_data().ok()?;
    ProgramData::try_deserialize(&mut &data[..]).ok()?.upgrade_authority_address
}

pub fn admin_init_vault(ctx: Context<AdminInitVault>) -> Result<()> {
    let a = &ctx.accounts;
    // 1. Only the upgrade authority can initialize (blocks deploy front-running).
    require!(upgrade_authority(&a.program, &a.program_data) == Some(a.admin.key()), VaultError::NotAdmin);
    // 2. The engine config, and its collateral.
    {
        let events_config = load_checked::<GlobalConfig>(&a.events_config, &agari_events::ID)?;
        require_keys_eq!(a.collateral_mint.key(), events_config.collateral_mint, VaultError::WrongCollateral);
    }

    let mut config = a.vault_config.load_init()?;
    config.admin = a.admin.key();
    config.events_config = a.events_config.key();
    config.collateral_mint = a.collateral_mint.key();
    config.seat = a.seat.key();
    config.next_grant_id = 1;
    config.seat_bump = ctx.bumps.seat;
    config.bump = ctx.bumps.vault_config;
    drop(config);

    emit!(VaultInitialized { config: a.vault_config.key(), admin: a.admin.key(), collateral_mint: a.collateral_mint.key(), seat: a.seat.key() });
    Ok(())
}
