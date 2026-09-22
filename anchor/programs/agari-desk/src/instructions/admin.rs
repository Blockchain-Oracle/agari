//! `admin_init_config`, `admin_set_attestors`, `admin_set_reference_feed` (desk.md §4.1). The admin is the program
//! upgrade authority at init, as in agari-events and agari-vault, so a deploy cannot be front-run into a foreign config.

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint};
use core::mem::size_of;

use crate::constants::{is_cluster_tag, DESK_CONFIG, DESK_CONFIG_SEED, DESK_REF_SEED, MAX_ATTESTORS, USDC_DECIMALS};
use crate::errors::DeskError;
use crate::events::{AttestorsSet, ConfigInitialized, ReferenceFeedSet};
use crate::program::AgariDesk;
use crate::state::{DeskConfig, DeskRef};

#[derive(Accounts)]
pub struct AdminInitConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + size_of::<DeskConfig>(), seeds = [DESK_CONFIG_SEED], bump)]
    pub config: AccountLoader<'info, DeskConfig>,
    /// The collateral: an SPL Token mint with 6 decimals (USDC on mainnet, a test mint on LiteSVM).
    pub usdc_mint: Account<'info, Mint>,
    /// CHECK: the router every operator swap goes through (Jupiter v6 on mainnet); only that it is executable is checked.
    pub swap_program: UncheckedAccount<'info>,
    pub program: Program<'info, AgariDesk>,
    /// CHECK: this program's ProgramData, whose upgrade authority must be `admin` (checked in the handler).
    pub program_data: UncheckedAccount<'info>,
    pub system_program: Program<'info, System>,
}

/// The upgrade authority recorded in this program's ProgramData, if `program_data` really is it.
fn upgrade_authority(program: &Program<AgariDesk>, program_data: &UncheckedAccount) -> Option<Pubkey> {
    if program.programdata_address().ok()?? != program_data.key() || *program_data.owner != anchor_lang::solana_program::bpf_loader_upgradeable::ID {
        return None;
    }
    let data = program_data.try_borrow_data().ok()?;
    ProgramData::try_deserialize(&mut &data[..]).ok()?.upgrade_authority_address
}

pub fn admin_init_config(ctx: Context<AdminInitConfig>, cluster_tag: u8, attestors: [Pubkey; MAX_ATTESTORS]) -> Result<()> {
    let a = &ctx.accounts;
    require!(upgrade_authority(&a.program, &a.program_data) == Some(a.admin.key()), DeskError::NotAdmin);
    require!(a.usdc_mint.decimals == USDC_DECIMALS && *a.usdc_mint.to_account_info().owner == token::ID, DeskError::WrongMint);
    require!(a.swap_program.executable, DeskError::WrongSwapProgram);
    require!(is_cluster_tag(cluster_tag), DeskError::BadClusterTag);

    let mut config = a.config.load_init()?;
    config.admin = a.admin.key();
    config.usdc_mint = a.usdc_mint.key();
    config.swap_program = a.swap_program.key();
    config.attestors = attestors;
    config.cluster_tag = cluster_tag;
    config.bump = ctx.bumps.config;
    drop(config);

    emit!(ConfigInitialized { config: a.config.key(), admin: a.admin.key(), usdc_mint: a.usdc_mint.key(), swap_program: a.swap_program.key(), cluster_tag });
    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct AdminSetAttestors<'info> {
    pub admin: Signer<'info>,
    #[account(mut, address = DESK_CONFIG, has_one = admin @ DeskError::NotAdmin)]
    pub config: AccountLoader<'info, DeskConfig>,
}

pub fn admin_set_attestors(ctx: Context<AdminSetAttestors>, attestors: [Pubkey; MAX_ATTESTORS]) -> Result<()> {
    ctx.accounts.config.load_mut()?.attestors = attestors;
    emit_cpi!(AttestorsSet { attestors });
    Ok(())
}

#[event_cpi]
#[derive(Accounts)]
pub struct AdminSetReferenceFeed<'info> {
    pub admin: Signer<'info>,
    #[account(address = DESK_CONFIG, has_one = admin @ DeskError::NotAdmin)]
    pub config: AccountLoader<'info, DeskConfig>,
    /// CHECK: only its key is read; it is the reference's seed and `has_one` binds it.
    pub mint: UncheckedAccount<'info>,
    #[account(mut, seeds = [DESK_REF_SEED, mint.key().as_ref()], bump = desk_ref.load()?.bump, has_one = mint @ DeskError::WrongMint)]
    pub desk_ref: AccountLoader<'info, DeskRef>,
}

/// The Pyth `Equity.Index` feed for this name (D-125): the switch-ready independent reference.
pub fn admin_set_reference_feed(ctx: Context<AdminSetReferenceFeed>, pyth_feed_id: [u8; 32]) -> Result<()> {
    ctx.accounts.desk_ref.load_mut()?.pyth_feed_id = pyth_feed_id;
    emit_cpi!(ReferenceFeedSet { mint: ctx.accounts.mint.key(), pyth_feed_id });
    Ok(())
}
