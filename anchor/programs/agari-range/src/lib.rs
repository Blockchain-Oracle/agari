//! agari-range: Masayume's RangeReserve on Solana (arithmetic mirrored by `packages/core/src/range`).
//!
//! A house-banked bet on where a Window's closing print lands. The buyer names a band and a side; the reserve
//! prices it off that Window's own opening print and venue mark, takes a stake, and locks the rest of the
//! payout out of its providers' capital. There is no order book: the reserve is the counterparty to every round.
//!
//! Money only ever leaves the vault to a round's owner or to a liquidity provider (AD-5), and settling, voiding
//! and claiming are all permissionless — the outcome is a fact the engine already recorded, so anyone may crank
//! it and nobody can redirect the proceeds.
//!
//! This file is dispatch only: the arithmetic lives in `math`, the Window read in `basis`, the balance sheet
//! in `state`, and the rules in `instructions`.

use anchor_lang::prelude::*;

pub mod basis;
pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod math;
pub mod state;

use instructions::*;
use state::RangeParams;

declare_id!("GfsAzxPeNp2cbUTrXehHBjLjAMX6Cf69gz2zJYkGM7ha");

#[program]
pub mod agari_range {
    use super::*;

    pub fn admin_init_reserve(ctx: Context<AdminInitReserve>, params: RangeParams) -> Result<()> {
        instructions::admin::admin_init_reserve(ctx, params)
    }

    pub fn admin_set_params(ctx: Context<AdminSetParams>, params: RangeParams, paused: bool) -> Result<()> {
        instructions::admin::admin_set_params(ctx, params, paused)
    }

    pub fn provider_supply(ctx: Context<Liquidity>, amount_base: u64) -> Result<()> {
        instructions::liquidity::supply(ctx, amount_base)
    }

    pub fn provider_withdraw(ctx: Context<Liquidity>, shares: u64) -> Result<()> {
        instructions::liquidity::withdraw(ctx, shares)
    }

    pub fn owner_open_round(
        ctx: Context<OpenRound>,
        is_inside: bool,
        low_print: i64,
        high_print: i64,
        max_payout_base: u64,
        max_stake_base: u64,
    ) -> Result<()> {
        instructions::open::open_round(ctx, is_inside, low_print, high_print, max_payout_base, max_stake_base)
    }

    pub fn public_settle_round(ctx: Context<SettleRound>) -> Result<()> {
        instructions::resolve::settle_round(ctx)
    }

    pub fn public_void_stale(ctx: Context<VoidStale>) -> Result<()> {
        instructions::resolve::void_stale(ctx)
    }

    pub fn public_claim_round(ctx: Context<ClaimRound>) -> Result<()> {
        instructions::resolve::claim_round(ctx)
    }
}
