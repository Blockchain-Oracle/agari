//! `admin_init_config(cluster_tag, result_retention_sec)` (events-instructions.md §1.1).

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, TokenAccount};
use core::mem::size_of;

use agari_common::seeds::CONFIG_SEED;

use crate::constants::is_cluster_tag;
use crate::errors::EventsError;
use crate::events::ConfigInitialized;
use crate::program::AgariEvents;
use crate::state::{GlobalConfig, Mode};

#[derive(Accounts)]
pub struct AdminInitConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + size_of::<GlobalConfig>(), seeds = [CONFIG_SEED], bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    /// CHECK: owner = SPL Token and a valid Mint, checked in order in the handler (Token-2022 is rejected).
    pub collateral_mint: UncheckedAccount<'info>,
    /// CHECK: an SPL Token account of `collateral_mint`, checked in the handler.
    pub treasury: UncheckedAccount<'info>,
    /// CHECK: must be `spl_token::ID`, checked in the handler.
    pub token_program: UncheckedAccount<'info>,
    pub program: Program<'info, AgariEvents>,
    /// CHECK: this program's ProgramData, whose upgrade authority must be `admin` (checked in the handler).
    pub program_data: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

/// The upgrade authority recorded in this program's ProgramData, if `program_data` really is it.
fn upgrade_authority(program: &Program<AgariEvents>, program_data: &UncheckedAccount) -> Option<Pubkey> {
    if program.programdata_address().ok()?? != program_data.key() || *program_data.owner != anchor_lang::solana_program::bpf_loader_upgradeable::ID {
        return None;
    }
    let data = program_data.try_borrow_data().ok()?;
    ProgramData::try_deserialize(&mut &data[..]).ok()?.upgrade_authority_address
}

pub fn admin_init_config(ctx: Context<AdminInitConfig>, cluster_tag: u8, result_retention_sec: u32) -> Result<()> {
    let a = &ctx.accounts;
    // 1. Only the upgrade authority can initialize (blocks deploy front-running).
    require!(upgrade_authority(&a.program, &a.program_data) == Some(a.admin.key()), EventsError::NotAdmin);
    // 2. SPL Token only.
    require!(a.token_program.key() == token::ID && *a.collateral_mint.owner == token::ID, EventsError::WrongTokenProgram);
    let mint = Mint::try_deserialize(&mut &a.collateral_mint.try_borrow_data()?[..]).map_err(|_| error!(EventsError::WrongMint))?;
    // 3. Treasury holds the collateral.
    require!(*a.treasury.owner == token::ID, EventsError::WrongMint);
    let treasury = TokenAccount::try_deserialize(&mut &a.treasury.try_borrow_data()?[..]).map_err(|_| error!(EventsError::WrongMint))?;
    require_keys_eq!(treasury.mint, a.collateral_mint.key(), EventsError::WrongMint);
    // 4. Cluster tag = core CLUSTER_ID.
    require!(is_cluster_tag(cluster_tag), EventsError::BadAuthorities);

    let mut config = a.config.load_init()?;
    config.admin = a.admin.key();
    config.collateral_mint = a.collateral_mint.key();
    config.token_program = token::ID;
    config.treasury = a.treasury.key();
    config.mode = u8::from(Mode::Normal);
    config.collateral_decimals = mint.decimals;
    config.cluster_tag = cluster_tag;
    config.bump = ctx.bumps.config;
    config.result_retention_sec = result_retention_sec;
    drop(config);

    emit!(ConfigInitialized { config: a.config.key(), admin: a.admin.key(), collateral_mint: a.collateral_mint.key(), cluster_tag });
    Ok(())
}
