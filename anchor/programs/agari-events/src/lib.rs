//! agari-events: DreamDEX Event Contracts rebuilt as an Anchor CLOB (plan P§3.1).
//! Spec: `docs/plan/specs/{events-engine,events-accounts,events-instructions,prints}.md`.
//! This file is dispatch only; logic lives in `instructions/`, `matching/`, `book/` and `state/`.

use anchor_lang::prelude::*;

pub mod book;
pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod matching;
pub mod state;

use events::OrderHandle;
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

    pub fn user_place_order(ctx: Context<UserPlaceOrder>, args: PlaceOrderArgs) -> Result<()> {
        instructions::user_place_order::user_place_order(ctx, args)
    }
    pub fn user_cancel_orders(ctx: Context<UserCancelOrders>, handles: Vec<OrderHandle>, seat_idx: u16, withdraw: bool) -> Result<()> {
        instructions::user_cancel_orders::user_cancel_orders(ctx, handles, seat_idx, withdraw)
    }

    pub fn user_reduce_order(ctx: Context<UserReduceOrder>, handle: OrderHandle, seat_idx: u16, new_lots: u64) -> Result<()> {
        instructions::user_reduce_order::user_reduce_order(ctx, handle, seat_idx, new_lots)
    }

    pub fn user_cancel_all(ctx: Context<UserCancelOrders>, seat_idx: u16, max_scan: u16, withdraw: bool) -> Result<()> {
        instructions::user_cancel_orders::user_cancel_all(ctx, seat_idx, max_scan, withdraw)
    }

    pub fn public_sweep_expired(ctx: Context<PublicSweepExpired>, max: u8) -> Result<()> {
        instructions::user_reduce_order::public_sweep_expired(ctx, max)
    }

    pub fn user_mint_complete_set(ctx: Context<UserCompleteSet>, lots: u64, seat_hint: u16, use_credit: bool) -> Result<()> {
        instructions::user_sets::user_mint_complete_set(ctx, lots, seat_hint, use_credit)
    }

    pub fn user_merge_complete_set(ctx: Context<UserCompleteSet>, lots: u64, seat_idx: u16, withdraw: bool) -> Result<()> {
        instructions::user_sets::user_merge_complete_set(ctx, lots, seat_idx, withdraw)
    }

    pub fn user_withdraw_credit(ctx: Context<UserWithdrawCredit>, seat_idx: u16, amount: u64) -> Result<()> {
        instructions::user_sets::user_withdraw_credit(ctx, seat_idx, amount)
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

    pub fn user_redeem(ctx: Context<UserRedeem>, seat_idx: u16, outcome: Option<u8>, lots: Option<u64>) -> Result<()> {
        instructions::redeem::user_redeem(ctx, seat_idx, outcome, lots)
    }

    pub fn public_redeem_for(ctx: Context<PublicRedeemFor>, seat_idx: u16) -> Result<()> {
        instructions::redeem::public_redeem_for(ctx, seat_idx)
    }
}
