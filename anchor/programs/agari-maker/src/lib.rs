//! agari-maker: Masayume's MarketMakerVault on Solana (mirrored by `packages/core/src/maker`).
//!
//! Pooled liquidity that quotes both sides of a Window through its own engine seat. Providers deposit collateral
//! and hold shares; one designated maker rests two-sided post-only quotes with it; anyone may merge the complete
//! sets that quoting produces, and anyone may settle a Window the venue has resolved.
//!
//! The vault never takes. A taker order would let it cross a book it is itself making and pay the spread to
//! whoever is resting there, so every quote is post-only: it rests at the price the vault chose, or it is refused.
//!
//! Collateral leaves custody only to a provider redeeming shares, or into the engine as escrow for a quote.
//! This file is dispatch only: the engine seam is in `engine`, the balance sheet in `state`.

use anchor_lang::prelude::*;

pub mod constants;
pub mod engine;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use instructions::*;
use state::MakerParams;

declare_id!("442oD4u4fHnAwPjSqdQvkgGeDaGVEZ9YHHaLny98nEaN");

#[program]
pub mod agari_maker {
    use super::*;

    pub fn admin_init_vault(ctx: Context<AdminInitVault>, maker: Pubkey, params: MakerParams) -> Result<()> {
        instructions::admin::admin_init_vault(ctx, maker, params)
    }

    pub fn admin_set_params(ctx: Context<AdminSetParams>, maker: Pubkey, params: MakerParams, paused: bool) -> Result<()> {
        instructions::admin::admin_set_params(ctx, maker, params, paused)
    }

    pub fn provider_supply(ctx: Context<Liquidity>, amount_base: u64) -> Result<()> {
        instructions::liquidity::supply(ctx, amount_base)
    }

    pub fn provider_withdraw(ctx: Context<Liquidity>, shares: u64) -> Result<()> {
        instructions::liquidity::withdraw(ctx, shares)
    }

    pub fn maker_quote(ctx: Context<MakerQuote>, bid_ticks: u16, ask_ticks: u16, lots: u64, expire_ts: i64) -> Result<()> {
        instructions::quote::maker_quote(ctx, bid_ticks, ask_ticks, lots, expire_ts)
    }

    pub fn maker_pull(ctx: Context<MakerPull>) -> Result<()> {
        instructions::quote::maker_pull(ctx)
    }

    pub fn public_merge(ctx: Context<Crank>, lots: u64) -> Result<()> {
        instructions::crank::public_merge(ctx, lots)
    }

    pub fn public_settle(ctx: Context<Crank>) -> Result<()> {
        instructions::crank::public_settle(ctx)
    }
}
