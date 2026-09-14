//! agari-events: DreamDEX Event Contracts rebuilt as an Anchor CLOB (plan P§3.1).
//! Spec: `docs/plan/specs/{events-engine,events-accounts,events-instructions,prints}.md`.
//! This file is dispatch only; logic lives in `instructions/`, `matching/`, `book/` and `state/`.

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;

declare_id!("cDcHZiQ1WYAHbSjxMoju86fbC8azrtQg7dzrWKynANH");

#[program]
pub mod agari_events {
    use super::*;

    pub fn admin_init_config(ctx: Context<AdminInitConfig>, cluster_tag: u8, result_retention_sec: u32) -> Result<()> {
        instructions::admin_init_config::admin_init_config(ctx, cluster_tag, result_retention_sec)
    }

    pub fn admin_set_authorities(ctx: Context<AdminSetAuthorities>, args: SetAuthoritiesArgs) -> Result<()> {
        instructions::admin_set_authorities::admin_set_authorities(ctx, args)
    }

    pub fn admin_set_mode(ctx: Context<AdminSetMode>, mode: u8) -> Result<()> {
        instructions::admin_set_authorities::admin_set_mode(ctx, mode)
    }

    pub fn admin_register_series(ctx: Context<AdminRegisterSeries>, args: RegisterSeriesArgs) -> Result<()> {
        instructions::admin_series::admin_register_series(ctx, args)
    }

    pub fn admin_add_book(ctx: Context<AdminAddBook>, capacity: u16) -> Result<()> {
        instructions::admin_series::admin_add_book(ctx, capacity)
    }

    pub fn admin_add_policy_version(ctx: Context<AdminAddPolicyVersion>, index: u8, version: PolicyVersionArgs) -> Result<()> {
        instructions::admin_series::admin_add_policy_version(ctx, index, version)
    }

    pub fn roller_open_window(ctx: Context<RollerOpenWindow>, args: OpenWindowArgs) -> Result<()> {
        instructions::roller_open_window::roller_open_window(ctx, args)
    }

    pub fn public_record_print_pyth(ctx: Context<PublicRecordPrintPyth>, which: u8) -> Result<()> {
        instructions::record_print_sources::public_record_print_pyth(ctx, which)
    }

    pub fn public_record_print_redstone(ctx: Context<PublicRecordPrintRedstone>, which: u8, payload: Vec<u8>) -> Result<()> {
        instructions::record_print_sources::public_record_print_redstone(ctx, which, payload)
    }

    pub fn public_record_print_attested(
        ctx: Context<PublicRecordPrintAttested>,
        which: u8,
        price: i64,
        expo: i32,
        bar_start_ts: i64,
        fetched_at_ts: i64,
    ) -> Result<()> {
        instructions::record_print_sources::public_record_print_attested(ctx, which, price, expo, bar_start_ts, fetched_at_ts)
    }

    pub fn public_copy_open_from_prev(ctx: Context<PublicCopyOpenFromPrev>) -> Result<()> {
        instructions::copy_open_from_prev::public_copy_open_from_prev(ctx)
    }

    pub fn public_settle_window(ctx: Context<PublicResolveWindow>) -> Result<()> {
        instructions::resolve_window::public_settle_window(ctx)
    }

    pub fn public_void_expired(ctx: Context<PublicResolveWindow>) -> Result<()> {
        instructions::resolve_window::public_void_expired(ctx)
    }
}
