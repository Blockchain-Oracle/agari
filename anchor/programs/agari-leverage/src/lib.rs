//! agari-leverage: Masayume's LeverageReserve on Solana (arithmetic mirrored by `packages/core/src/leverage`).
//!
//! Prefunded, capped leverage on the venue's Windows: a knock-out certificate on the venue's own contracts. A stake
//! at L× buys `stake·L / price` contracts; the reserve fronts `(L−1)·stake` for a premium, buys them off the resting
//! book as the venue's taker, and holds them as its own hedge. Its claim is repaid first out of whatever the
//! contracts fetch: at settlement, at the owner's cash-out, or at the knock-out anyone may trigger once the book's
//! mark reaches the maintenance line. The owner's loss is never more than the stake; the reserve's is the gap
//! between that line and what the book actually pays, bounded by public caps.
//!
//! Every exit pays the position's owner, never the caller (AD-5), and no exit waits on the owner's token account.
//!
//! This file is dispatch only: the arithmetic lives in `math`, the venue seam in `engine`, the balance sheet in
//! `state`, and the rules in `instructions`.

use anchor_lang::prelude::*;

pub mod constants;
pub mod engine;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod math;
pub mod state;

use instructions::*;
use state::LeverageParams;

declare_id!("2yMrhq686tL6uAUFHfKGsPZAWSGoQoRW9HxNvnAZJeQb");

#[program]
pub mod agari_leverage {
    use super::*;

    pub fn admin_init_reserve(ctx: Context<AdminInitReserve>, params: LeverageParams) -> Result<()> {
        instructions::admin::admin_init_reserve(ctx, params)
    }

    pub fn admin_set_params(ctx: Context<AdminSetParams>, params: LeverageParams, paused: bool) -> Result<()> {
        instructions::admin::admin_set_params(ctx, params, paused)
    }

    pub fn provider_supply(ctx: Context<Liquidity>, amount_base: u64) -> Result<()> {
        instructions::liquidity::supply(ctx, amount_base)
    }

    pub fn provider_withdraw(ctx: Context<Liquidity>, shares: u64) -> Result<()> {
        instructions::liquidity::withdraw(ctx, shares)
    }

    pub fn owner_open(ctx: Context<OwnerOpen>, outcome: u8, stake_base: u64, leverage_bps: u32, min_lots: u64) -> Result<()> {
        instructions::open::owner_open(ctx, outcome, stake_base, leverage_bps, min_lots)
    }

    pub fn owner_close(ctx: Context<SellPosition>, min_proceeds_base: u64) -> Result<()> {
        instructions::sell::owner_close(ctx, min_proceeds_base)
    }

    pub fn public_knock_out(ctx: Context<SellPosition>) -> Result<()> {
        instructions::sell::public_knock_out(ctx)
    }

    pub fn public_settle(ctx: Context<PublicSettle>) -> Result<()> {
        instructions::settle::public_settle(ctx)
    }

    pub fn public_claim(ctx: Context<PublicClaim>) -> Result<()> {
        instructions::settle::public_claim(ctx)
    }
}
