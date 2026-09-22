//! Desk events (desk.md §4.7), in Borsh order. `admin_init_config` has no event-CPI accounts and uses `emit!`; every
//! other instruction uses `emit_cpi!`. `history.ts` decodes them by signature for reconcile and the Proof section.

use anchor_lang::prelude::*;

#[event]
pub struct ConfigInitialized {
    pub config: Pubkey,
    pub admin: Pubkey,
    pub usdc_mint: Pubkey,
    pub swap_program: Pubkey,
    pub cluster_tag: u8,
}

#[event]
pub struct AttestorsSet {
    pub attestors: [Pubkey; 4],
}

#[event]
pub struct ReferenceInitialized {
    pub mint: Pubkey,
    pub reference: Pubkey,
}

#[event]
pub struct ReferenceFeedSet {
    pub mint: Pubkey,
    pub pyth_feed_id: [u8; 32],
}

#[event]
pub struct ReferencePosted {
    pub mint: Pubkey,
    pub token_price_e8: u64,
    pub mark_price_e8: u64,
    pub multiplier_e12: u64,
    pub fetched_at_sec: i64,
    pub posted_by: Pubkey,
}

#[event]
pub struct DeskOpened {
    pub owner: Pubkey,
    pub desk: Pubkey,
    pub operator: Pubkey,
    pub per_action_cap: u64,
    pub daily_cap: u64,
    pub max_premium_bps: u16,
    pub mode: u8,
}

#[event]
pub struct TokenAllowed {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub index: u8,
}

#[event]
pub struct TokenDisallowed {
    pub owner: Pubkey,
    pub mint: Pubkey,
}

#[event]
pub struct Deposited {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
}

#[event]
pub struct Withdrawn {
    pub owner: Pubkey,
    pub mint: Pubkey,
    pub amount: u64,
}

#[event]
pub struct LimitsSet {
    pub owner: Pubkey,
    pub per_action_cap: u64,
    pub daily_cap: u64,
    pub max_premium_bps: u16,
    pub require_pyth_index: bool,
}

#[event]
pub struct ModeSet {
    pub owner: Pubkey,
    pub mode: u8,
}

#[event]
pub struct OperatorSet {
    pub owner: Pubkey,
    pub operator: Pubkey,
}

#[event]
pub struct OperatorRevoked {
    pub owner: Pubkey,
}

#[event]
pub struct Paused {
    pub owner: Pubkey,
    pub by: Pubkey,
}

#[event]
pub struct Unpaused {
    pub owner: Pubkey,
}

/// One buy through the router. `reference_source`: 0 the PreStocks mark, 1 Pyth's index.
#[event]
pub struct Bought {
    pub owner: Pubkey,
    pub seq: u64,
    pub mint: Pubkey,
    pub usdc_in: u64,
    pub token_out: u64,
    pub token_price_e8: u64,
    pub reference_e8: u64,
    pub reference_source: u8,
    pub decision_hash: [u8; 32],
    pub head: [u8; 32],
}

/// One sell. `counted_usdc` is what the caps charged: the larger of what came back and the attested value.
#[event]
pub struct Sold {
    pub owner: Pubkey,
    pub seq: u64,
    pub mint: Pubkey,
    pub token_in: u64,
    pub usdc_out: u64,
    pub token_price_e8: u64,
    pub counted_usdc: u64,
    pub decision_hash: [u8; 32],
    pub head: [u8; 32],
}

/// "Did nothing", sealed into the chain like any action.
#[event]
pub struct Checkpoint {
    pub owner: Pubkey,
    pub seq: u64,
    pub decision_hash: [u8; 32],
    pub head: [u8; 32],
}
