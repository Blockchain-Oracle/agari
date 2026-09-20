//! agari-arena: Masayume's GameArena on Solana. A two-player duel over real Windows: each card is one confirmed IOC
//! pick, and only the side-pot is the arena's to award.
//!
//! The economic spine: a pick's cost and quantity are what the engine reported around the IOC, a card's payout is
//! what the engine paid at redemption, and the winner is the greater sum of `payout − cost`. Nothing in this program
//! prices anything. The pot is the only money it decides.
//!
//! Card settlement is deliberately independent of the pot. A match whose pot was forfeited or refunded still holds
//! two players' real positions, so `public_settle_card` keeps working in every status past the reveal. Credits pay
//! the player, never the caller (AD-5), and `creator` and `challenger` are never rewritten.
//!
//! The arena trades as a PROGRAM seat of agari-events (`program_authorities[4]`, D-063), so every pick's contracts
//! sit pooled in one seat and a settlement redeems exactly one pick's lots.

use anchor_lang::prelude::*;

pub mod commitment;
pub mod constants;
pub mod engine;
pub mod errors;
pub mod events;
pub mod instructions;
pub mod state;

use constants::TIERS;
use instructions::*;
use state::{ArenaParams, Tier};

declare_id!("CakGVH2CaM2YAF9edgMTrCv1HCFf5tgbTcinN24JWvR3");

#[program]
pub mod agari_arena {
    use super::*;

    pub fn admin_init_arena(ctx: Context<AdminInitArena>, chain_id: u64, params: ArenaParams, tiers: [Tier; TIERS]) -> Result<()> {
        instructions::admin::admin_init_arena(ctx, chain_id, params, tiers)
    }

    pub fn admin_set_params(ctx: Context<AdminOnly>, params: ArenaParams) -> Result<()> {
        instructions::admin::admin_set_params(ctx, params)
    }

    pub fn admin_set_tier(ctx: Context<AdminOnly>, tier: u8, value: Tier) -> Result<()> {
        instructions::admin::admin_set_tier(ctx, tier, value)
    }

    pub fn admin_set_paused(ctx: Context<AdminOnly>, paused: bool) -> Result<()> {
        instructions::admin::admin_set_paused(ctx, paused)
    }

    pub fn player_create_match(ctx: Context<PlayerCreateMatch>, match_id: [u8; 32], challenger: Pubkey, tier: u8, deck_hash: [u8; 32], deck_size: u8, policy_version: u32) -> Result<()> {
        instructions::entry::player_create_match(ctx, match_id, challenger, tier, deck_hash, deck_size, policy_version)
    }

    pub fn player_join_match(ctx: Context<PlayerJoinMatch>, match_id: [u8; 32]) -> Result<()> {
        instructions::entry::player_join_match(ctx, match_id)
    }

    pub fn player_authorize_agent(ctx: Context<PlayerAuthorizeAgent>, match_id: [u8; 32], agent: Pubkey, ttl_sec: u32) -> Result<()> {
        instructions::agent::player_authorize_agent(ctx, match_id, agent, ttl_sec)
    }

    pub fn public_release_agent(ctx: Context<ReleaseAgent>, match_id: [u8; 32]) -> Result<()> {
        instructions::agent::public_release_agent(ctx, match_id)
    }

    pub fn public_reveal_deck<'info>(ctx: Context<'info, PublicRevealDeck<'info>>, match_id: [u8; 32], server_seed: [u8; 32], client_seeds: Vec<[u8; 32]>) -> Result<()> {
        instructions::reveal::public_reveal_deck(ctx, match_id, server_seed, client_seeds)
    }

    pub fn player_place_pick(ctx: Context<PlayerPlacePick>, match_id: [u8; 32], card_index: u8, outcome: u8, stake_base: u64, min_lots: u64) -> Result<()> {
        instructions::pick::player_place_pick(ctx, match_id, card_index, outcome, stake_base, min_lots)
    }

    pub fn agent_place_pick(ctx: Context<AgentPlacePick>, match_id: [u8; 32], card_index: u8, outcome: u8, stake_base: u64, min_lots: u64) -> Result<()> {
        instructions::pick::agent_place_pick(ctx, match_id, card_index, outcome, stake_base, min_lots)
    }

    pub fn public_lock_picks(ctx: Context<MatchAndCredits>, match_id: [u8; 32]) -> Result<()> {
        instructions::exits::public_lock_picks(ctx, match_id)
    }

    pub fn public_settle_card(ctx: Context<PublicSettleCard>, match_id: [u8; 32], card_index: u8) -> Result<()> {
        instructions::settle::public_settle_card(ctx, match_id, card_index)
    }

    pub fn public_finalize(ctx: Context<MatchAndCredits>, match_id: [u8; 32]) -> Result<()> {
        instructions::settle::public_finalize(ctx, match_id)
    }

    pub fn player_cancel_match(ctx: Context<MatchAndCredits>, match_id: [u8; 32]) -> Result<()> {
        instructions::exits::player_cancel_match(ctx, match_id)
    }

    pub fn public_refund_unjoined(ctx: Context<MatchAndCredits>, match_id: [u8; 32]) -> Result<()> {
        instructions::exits::public_refund_unjoined(ctx, match_id)
    }

    pub fn public_refund_unrevealed(ctx: Context<MatchAndCredits>, match_id: [u8; 32]) -> Result<()> {
        instructions::exits::public_refund_unrevealed(ctx, match_id)
    }

    pub fn public_claim_credit(ctx: Context<PublicClaimCredit>) -> Result<()> {
        instructions::exits::public_claim_credit(ctx)
    }

    pub fn admin_create_season(ctx: Context<AdminCreateSeason>, season_id: String, ends_at_sec: i64) -> Result<()> {
        instructions::season::admin_create_season(ctx, season_id, ends_at_sec)
    }

    pub fn public_deposit_season(ctx: Context<PublicDepositSeason>, amount_base: u64) -> Result<()> {
        instructions::season::public_deposit_season(ctx, amount_base)
    }

    pub fn admin_distribute_season<'info>(ctx: Context<'info, AdminSeason<'info>>, amounts_base: Vec<u64>) -> Result<()> {
        instructions::season::admin_distribute_season(ctx, amounts_base)
    }

    pub fn admin_withdraw_season_remainder<'info>(ctx: Context<'info, AdminSeason<'info>>) -> Result<()> {
        instructions::season::admin_withdraw_season_remainder(ctx)
    }
}
