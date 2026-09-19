//! agari-parlay: Masayume's ParlayReserve on Solana (arithmetic mirrored by `packages/core/src/parlay`).
//!
//! A house-banked ticket over two or more Windows: every leg must come in. The reserve prices each leg off that
//! Window's own book, multiplies them, applies a correlation floor where legs settle on one print, takes a stake
//! and locks the rest of the payout out of its providers' capital.
//!
//! Legs resolve one at a time and permissionlessly, in the order their Windows close, because nobody should wait
//! for the last Window to learn the first went against them. Money only ever leaves the vault to a ticket's owner
//! or to a liquidity provider (AD-5).
//!
//! This file is dispatch only: the arithmetic lives in `math`, the venue reads in `legs`, the balance sheet and
//! the ticket's state machine in `state`, and the rules in `instructions`.

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod legs;
pub mod math;
pub mod state;

use instructions::*;
use state::ParlayParams;

declare_id!("H4gdpoPirbtHP6hNdiQRLwfifjshdgDamYuvrGxj2ZCC");

#[program]
pub mod agari_parlay {
    use super::*;

    pub fn admin_init_reserve(ctx: Context<AdminInitReserve>, params: ParlayParams) -> Result<()> {
        instructions::admin::admin_init_reserve(ctx, params)
    }

    pub fn admin_set_params(ctx: Context<AdminSetParams>, params: ParlayParams, paused: bool) -> Result<()> {
        instructions::admin::admin_set_params(ctx, params, paused)
    }

    pub fn provider_supply(ctx: Context<Liquidity>, amount_base: u64) -> Result<()> {
        instructions::liquidity::supply(ctx, amount_base)
    }

    pub fn provider_withdraw(ctx: Context<Liquidity>, shares: u64) -> Result<()> {
        instructions::liquidity::withdraw(ctx, shares)
    }

    pub fn owner_open_parlay(ctx: Context<OpenParlay>, legs_up: Vec<bool>, max_payout_base: u64, max_stake_base: u64) -> Result<()> {
        instructions::open::open_parlay(ctx, legs_up, max_payout_base, max_stake_base)
    }

    pub fn public_resolve_leg(ctx: Context<DecideTicket>, leg_idx: u8) -> Result<()> {
        instructions::resolve::resolve_leg(ctx, leg_idx)
    }

    pub fn public_void_stale(ctx: Context<DecideTicket>) -> Result<()> {
        instructions::resolve::void_stale(ctx)
    }

    pub fn public_claim_parlay(ctx: Context<ClaimParlay>) -> Result<()> {
        instructions::resolve::claim_parlay(ctx)
    }
}
