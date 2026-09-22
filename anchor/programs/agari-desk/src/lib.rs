//! agari-desk: Shijima's desk on Solana (S21, D-126; spec `docs/plan/specs/desk.md`). A PDA per owner holds a basket
//! of PreStocks tokens; the owner decides what to own and can always take it out; the operator decides only when and
//! may only trade inside caps, an 8 % band and a premium ceiling, through the configured router by CPI; every action,
//! "did nothing" included, carries a decision hash and advances a hash chain in the same transaction.
//! This file is dispatch only; logic lives in `instructions/`, `guard`, `reference` and `chain`.

use anchor_lang::prelude::*;

pub mod chain;
pub mod constants;
pub mod errors;
pub mod events;
pub mod guard;
pub mod instructions;
pub mod reference;
pub mod state;

use instructions::*;

declare_id!("4gAfiRauANHVajpErqCey7iWGbKkyuSsnXLRbApVaWak");

#[program]
pub mod agari_desk {
    use super::*;

    pub fn admin_init_config(ctx: Context<AdminInitConfig>, cluster_tag: u8, attestors: [Pubkey; 4]) -> Result<()> {
        instructions::admin::admin_init_config(ctx, cluster_tag, attestors)
    }

    pub fn admin_set_attestors(ctx: Context<AdminSetAttestors>, attestors: [Pubkey; 4]) -> Result<()> {
        instructions::admin::admin_set_attestors(ctx, attestors)
    }

    pub fn admin_set_reference_feed(ctx: Context<AdminSetReferenceFeed>, pyth_feed_id: [u8; 32]) -> Result<()> {
        instructions::admin::admin_set_reference_feed(ctx, pyth_feed_id)
    }

    pub fn public_init_reference(ctx: Context<PublicInitReference>) -> Result<()> {
        instructions::reference::public_init_reference(ctx)
    }

    pub fn public_post_reference(ctx: Context<PublicPostReference>, token_price_e8: u64, mark_price_e8: u64, multiplier_e12: u64, fetched_at_sec: i64) -> Result<()> {
        instructions::reference::public_post_reference(ctx, token_price_e8, mark_price_e8, multiplier_e12, fetched_at_sec)
    }

    pub fn owner_open_desk(ctx: Context<OwnerOpenDesk>, operator: Pubkey, per_action_cap: u64, daily_cap: u64, max_premium_bps: u16, mode: u8) -> Result<()> {
        instructions::open::owner_open_desk(ctx, operator, per_action_cap, daily_cap, max_premium_bps, mode)
    }

    pub fn owner_allow_token(ctx: Context<OwnerAllowToken>) -> Result<()> {
        instructions::open::owner_allow_token(ctx)
    }

    pub fn owner_disallow_token(ctx: Context<OwnerDisallowToken>) -> Result<()> {
        instructions::open::owner_disallow_token(ctx)
    }

    pub fn owner_deposit(ctx: Context<OwnerDeposit>, amount: u64) -> Result<()> {
        instructions::funding::owner_deposit(ctx, amount)
    }

    pub fn owner_withdraw(ctx: Context<OwnerWithdraw>, amount: u64) -> Result<()> {
        instructions::funding::owner_withdraw(ctx, amount)
    }

    pub fn owner_set_limits(ctx: Context<OwnerControls>, per_action_cap: u64, daily_cap: u64, max_premium_bps: u16, require_pyth_index: bool) -> Result<()> {
        instructions::controls::owner_set_limits(ctx, per_action_cap, daily_cap, max_premium_bps, require_pyth_index)
    }

    pub fn owner_set_mode(ctx: Context<OwnerControls>, mode: u8) -> Result<()> {
        instructions::controls::owner_set_mode(ctx, mode)
    }

    pub fn owner_set_operator(ctx: Context<OwnerControls>, operator: Pubkey) -> Result<()> {
        instructions::controls::owner_set_operator(ctx, operator)
    }

    pub fn owner_revoke_operator(ctx: Context<OwnerControls>) -> Result<()> {
        instructions::controls::owner_revoke_operator(ctx)
    }

    pub fn owner_unpause(ctx: Context<OwnerControls>) -> Result<()> {
        instructions::controls::owner_unpause(ctx)
    }

    pub fn pause(ctx: Context<Pause>) -> Result<()> {
        instructions::controls::pause(ctx)
    }

    pub fn operator_buy<'info>(ctx: Context<'info, OperatorSwap<'info>>, usdc_in: u64, min_token_out: u64, deadline_sec: i64, decision_hash: [u8; 32], swap_data: Vec<u8>) -> Result<()> {
        instructions::swap::operator_buy(ctx, usdc_in, min_token_out, deadline_sec, decision_hash, swap_data)
    }

    pub fn operator_sell<'info>(ctx: Context<'info, OperatorSwap<'info>>, token_in: u64, min_usdc_out: u64, deadline_sec: i64, decision_hash: [u8; 32], swap_data: Vec<u8>) -> Result<()> {
        instructions::swap::operator_sell(ctx, token_in, min_usdc_out, deadline_sec, decision_hash, swap_data)
    }

    pub fn operator_checkpoint(ctx: Context<OperatorCheckpoint>, deadline_sec: i64, decision_hash: [u8; 32]) -> Result<()> {
        instructions::checkpoint::operator_checkpoint(ctx, deadline_sec, decision_hash)
    }
}
