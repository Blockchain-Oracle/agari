//! `admin_register_series`, `admin_add_book` and `admin_add_policy_version` (events-instructions.md §1.4–1.6).

use anchor_lang::prelude::*;
use core::mem::size_of;

use agari_common::grid::cash_unit;
use agari_common::seeds::{CONFIG_SEED, SERIES_SEED};

use super::args::{PolicyVersionArgs, RegisterSeriesArgs};
use super::policy_rules::{validate_policy_version, PolicyContext};
use crate::constants::{
    BOOK_CAPACITY_LARGE, BOOK_CAPACITY_SMALL, CADENCE_DIVIDES_SEC, GAP_CADENCE_SEC, MAX_EVICTIONS_CAP, MAX_FILLS_CAP,
    MAX_FREE_BOOKS, MAX_POLICY_VERSIONS,
};
use crate::errors::EventsError;
use crate::events::{BookAdded, PolicyVersionAdded, SeriesRegistered};
use crate::state::{book_space, Basis, Book, GlobalConfig, PolicyVersion, Series};

#[derive(Accounts)]
#[instruction(args: RegisterSeriesArgs)]
pub struct AdminRegisterSeries<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    #[account(
        init,
        payer = admin,
        space = 8 + size_of::<Series>(),
        seeds = [SERIES_SEED, &args.ticker.to_le_bytes(), &args.cadence_sec.to_le_bytes(), &[args.basis]],
        bump
    )]
    pub series: AccountLoader<'info, Series>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct AdminAddBook<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    #[account(mut)]
    pub series: AccountLoader<'info, Series>,
    /// Created earlier in the same transaction by System `createAccount` (owner = this program).
    #[account(zero)]
    pub book: AccountLoader<'info, Book>,
}

#[derive(Accounts)]
pub struct AdminAddPolicyVersion<'info> {
    pub admin: Signer<'info>,
    #[account(seeds = [CONFIG_SEED], bump = config.load()?.bump)]
    pub config: AccountLoader<'info, GlobalConfig>,
    #[account(mut)]
    pub series: AccountLoader<'info, Series>,
}

/// Step 2: Regular/Token cadences divide an hour; the Gap seed is one week (D-013).
fn cadence_valid(basis: u8, cadence_sec: u32) -> bool {
    match Basis::try_from(basis) {
        Ok(Basis::Regular | Basis::Token24x7) => cadence_sec >= 60 && cadence_sec % 60 == 0 && CADENCE_DIVIDES_SEC % cadence_sec == 0,
        Ok(Basis::Gap) => cadence_sec == GAP_CADENCE_SEC,
        Err(()) => false,
    }
}

pub fn admin_register_series(ctx: Context<AdminRegisterSeries>, args: RegisterSeriesArgs) -> Result<()> {
    let config = ctx.accounts.config.load()?;
    require_keys_eq!(ctx.accounts.admin.key(), config.admin, EventsError::NotAdmin);
    require!(cadence_valid(args.basis, args.cadence_sec), EventsError::BadAlignment);
    require!(args.min_lots >= 1, EventsError::BadGrid);
    let cu = cash_unit(args.lot_base, args.tick_base, config.collateral_decimals).map_err(|_| error!(EventsError::BadGrid))?;
    require!(
        (1..=MAX_FILLS_CAP).contains(&args.fills_cap) && args.evictions_cap <= MAX_EVICTIONS_CAP && args.max_lead_sec >= 1,
        EventsError::BadSeriesParams
    );
    drop(config);

    let mut series = ctx.accounts.series.load_init()?;
    series.ticker = args.ticker;
    series.basis = args.basis;
    series.bump = ctx.bumps.series;
    series.cadence_sec = args.cadence_sec;
    series.lot_base = args.lot_base;
    series.tick_base = args.tick_base;
    series.cash_unit = cu;
    series.min_lots = args.min_lots;
    series.seat_bond = args.seat_bond;
    series.min_rest_slots = args.min_rest_slots;
    series.max_lead_sec = args.max_lead_sec;
    series.fills_cap = args.fills_cap;
    series.evictions_cap = args.evictions_cap;
    drop(series);

    emit!(SeriesRegistered {
        series: ctx.accounts.series.key(),
        ticker: args.ticker,
        cadence_sec: args.cadence_sec,
        basis: args.basis,
        cash_unit: cu,
    });
    Ok(())
}

pub fn admin_add_book(ctx: Context<AdminAddBook>, capacity: u16) -> Result<()> {
    let a = &ctx.accounts;
    require_keys_eq!(a.admin.key(), a.config.load()?.admin, EventsError::NotAdmin);
    let cap = u32::from(capacity);
    require!(
        (cap == BOOK_CAPACITY_SMALL || cap == BOOK_CAPACITY_LARGE) && a.book.to_account_info().data_len() == book_space(usize::from(capacity)),
        EventsError::BadBookSize
    );
    let mut series = a.series.load_mut()?;
    let count = usize::from(series.free_book_count);
    require!(count < MAX_FREE_BOOKS, EventsError::TooManyBooks);

    let mut book = a.book.load_init()?;
    book.series = a.series.key();
    book.capacity = cap;
    drop(book);
    series.free_books[count] = a.book.key();
    series.free_book_count += 1;
    drop(series);

    emit!(BookAdded { series: a.series.key(), book: a.book.key(), capacity });
    Ok(())
}

pub fn admin_add_policy_version(ctx: Context<AdminAddPolicyVersion>, index: u8, version: PolicyVersionArgs) -> Result<()> {
    let config = ctx.accounts.config.load()?;
    require_keys_eq!(ctx.accounts.admin.key(), config.admin, EventsError::NotAdmin);
    let mut series = ctx.accounts.series.load_mut()?;
    require!(index >= series.version_count, EventsError::PolicyVersionImmutable);
    require!(index == series.version_count && usize::from(index) < MAX_POLICY_VERSIONS, EventsError::UnknownPolicyVersion);
    let version = PolicyVersion::from(version);
    let context = PolicyContext {
        basis: series.basis,
        redstone_signer_count: config.redstone_signer_count,
        redstone_threshold: config.redstone_threshold,
    };
    validate_policy_version(&version, &context)?;

    series.policy_versions[usize::from(index)] = version;
    series.version_count += 1;
    drop(series);

    emit!(PolicyVersionAdded {
        series: ctx.accounts.series.key(),
        index,
        valid_from_ts: version.valid_from_ts,
        valid_until_ts: version.valid_until_ts,
        primary_source: version.primary.source,
        check_source: version.check.source,
    });
    Ok(())
}
