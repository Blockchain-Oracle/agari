//! agari-strategy: Masayume's StrategyRegistry on Solana (records mirrored by `packages/core/src/strategies`).
//!
//! Who may copy-trade whom, under which ceilings, for what fee. A creator publishes a strategy bound to one runner
//! key and a caps envelope; a subscriber proves a live `agari-vault` strategy grant to that runner, inside the
//! envelope, and pays the creator's fee. The registry has no custody and moves nothing but that fee: execution and
//! every ceiling live on the vault (AD-5), and the runner can only ever open positions the subscriber owns.
//!
//! One thing differs from the reference in shape and not in substance. A strategy's published words are longer than
//! a Solana transaction, so they are written in pieces and then sealed against a hash declared up front. They are
//! still on chain and still in the open, and a strategy takes no subscribers until its text is whole.

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;
use state::Envelope;

declare_id!("2yiPYmuNQxpfC3nCk66KzkW72uCbkT6hHwLRSHpYDskQ");

#[program]
pub mod agari_strategy {
    use super::*;

    pub fn admin_init_registry(ctx: Context<AdminInitRegistry>) -> Result<()> {
        instructions::admin::admin_init_registry(ctx)
    }

    pub fn creator_publish(ctx: Context<CreatorPublish>, runner: Pubkey, envelope: Envelope, revision: Revision) -> Result<()> {
        instructions::creator::creator_publish(ctx, runner, envelope, revision)
    }

    pub fn creator_write_metadata(ctx: Context<CreatorEdit>, offset: u16, chunk: Vec<u8>) -> Result<()> {
        instructions::creator::creator_write_metadata(ctx, offset, chunk)
    }

    pub fn creator_seal(ctx: Context<CreatorEdit>) -> Result<()> {
        instructions::creator::creator_seal(ctx)
    }

    pub fn creator_update(ctx: Context<CreatorEdit>, revision: Revision) -> Result<()> {
        instructions::creator::creator_update(ctx, revision)
    }

    pub fn creator_set_runner(ctx: Context<CreatorEdit>, runner: Pubkey) -> Result<()> {
        instructions::creator::creator_set_runner(ctx, runner)
    }

    pub fn creator_deactivate(ctx: Context<CreatorEdit>) -> Result<()> {
        instructions::creator::creator_deactivate(ctx)
    }

    pub fn subscriber_subscribe(ctx: Context<Subscribe>, max_fee_base: u64) -> Result<()> {
        instructions::subscriber::subscribe(ctx, max_fee_base)
    }

    pub fn subscriber_unsubscribe(ctx: Context<Unsubscribe>) -> Result<()> {
        instructions::subscriber::unsubscribe(ctx)
    }
}
