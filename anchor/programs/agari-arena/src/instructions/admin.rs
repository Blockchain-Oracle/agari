use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use agari_common::view::load_checked;
use agari_events::state::GlobalConfig;

use crate::constants::{ARENA_SEED, CUSTODY_SEED, EVENTS_CONFIG, SEAT_SEED, TIERS};
use crate::errors::ArenaError;
use crate::events::{ParamsUpdated, PausedSet, TierSet};
use crate::program::AgariArena;
use crate::state::{Arena, ArenaParams, Tier};

#[derive(Accounts)]
pub struct AdminInitArena<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(init, payer = admin, space = 8 + Arena::INIT_SPACE, seeds = [ARENA_SEED], bump)]
    pub arena: Box<Account<'info, Arena>>,
    /// CHECK: the arena's engine seat. It signs every CPI, so custody is held in its name and nobody else's.
    #[account(seeds = [SEAT_SEED], bump)]
    pub seat: UncheckedAccount<'info>,
    /// Every unit the arena holds: open pots, players' credits, keys' escrows.
    #[account(init, payer = admin, seeds = [CUSTODY_SEED], bump, token::mint = collateral_mint, token::authority = seat)]
    pub custody: InterfaceAccount<'info, TokenAccount>,
    /// CHECK: the venue's config, at its own address; its collateral has to be this arena's.
    #[account(address = EVENTS_CONFIG @ ArenaError::UnknownMarket)]
    pub events_config: UncheckedAccount<'info>,
    pub collateral_mint: InterfaceAccount<'info, Mint>,
    pub program: Program<'info, AgariArena>,
    /// CHECK: this program's ProgramData, matched against `program` below.
    pub program_data: UncheckedAccount<'info>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

fn upgrade_authority(program: &Program<AgariArena>, program_data: &UncheckedAccount) -> Option<Pubkey> {
    if program.programdata_address().ok()?? != program_data.key() || *program_data.owner != anchor_lang::solana_program::bpf_loader_upgradeable::ID {
        return None;
    }
    let data = program_data.try_borrow_data().ok()?;
    ProgramData::try_deserialize(&mut &data[..]).ok()?.upgrade_authority_address
}

/// Only the program's upgrade authority can initialise it. `chain_id` is the cluster id the deck commitment carries
/// (`CLUSTER_ID` in `@agari/core`), fixed here for good.
pub fn admin_init_arena(ctx: Context<AdminInitArena>, chain_id: u64, params: ArenaParams, tiers: [Tier; TIERS]) -> Result<()> {
    let a = &ctx.accounts;
    require!(upgrade_authority(&a.program, &a.program_data) == Some(a.admin.key()), ArenaError::NotAdmin);
    params.validate()?;
    {
        let venue = load_checked::<GlobalConfig>(&a.events_config, &agari_events::ID)?;
        require_keys_eq!(a.collateral_mint.key(), venue.collateral_mint, ArenaError::WrongCollateral);
    }
    let (admin, mint) = (a.admin.key(), a.collateral_mint.key());
    let arena = &mut ctx.accounts.arena;
    arena.admin = admin;
    arena.collateral_mint = mint;
    arena.chain_id = chain_id;
    arena.params = params;
    arena.tiers = tiers;
    arena.bump = ctx.bumps.arena;
    arena.seat_bump = ctx.bumps.seat;
    arena.custody_bump = ctx.bumps.custody;
    emit!(ParamsUpdated { params });
    for (i, t) in tiers.iter().enumerate() {
        emit!(TierSet { tier: i as u8, pot_base: t.pot_base, per_card_cap_base: t.per_card_cap_base, enabled: t.enabled });
    }
    Ok(())
}

#[derive(Accounts)]
pub struct AdminOnly<'info> {
    pub admin: Signer<'info>,
    #[account(mut, seeds = [ARENA_SEED], bump = arena.bump, has_one = admin @ ArenaError::NotAdmin)]
    pub arena: Box<Account<'info, Arena>>,
}

pub fn admin_set_params(ctx: Context<AdminOnly>, params: ArenaParams) -> Result<()> {
    params.validate()?;
    ctx.accounts.arena.params = params;
    emit!(ParamsUpdated { params });
    Ok(())
}

/// A match keeps the pot and the cap it was created with, so re-pricing a tier never touches a match in play.
pub fn admin_set_tier(ctx: Context<AdminOnly>, tier: u8, value: Tier) -> Result<()> {
    let slot = ctx.accounts.arena.tiers.get_mut(usize::from(tier)).ok_or(ArenaError::UnknownTier)?;
    *slot = value;
    emit!(TierSet { tier, pot_base: value.pot_base, per_card_cap_base: value.per_card_cap_base, enabled: value.enabled });
    Ok(())
}

/// Stops new matches, joins and picks. It never stops a lock, a settlement, a refund or a claim.
pub fn admin_set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
    ctx.accounts.arena.paused = paused;
    emit!(PausedSet { paused });
    Ok(())
}
