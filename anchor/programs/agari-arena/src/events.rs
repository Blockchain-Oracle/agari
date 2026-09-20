//! `IGameArena`'s events in its own vocabulary. Every economic event carries the match id, and the projector reads
//! these rather than account diffs, so exactly one place knows how a duel is told.

use anchor_lang::prelude::*;

use crate::state::{ArenaParams, MatchStatus, RefundReason};

#[event]
pub struct ParamsUpdated {
    pub params: ArenaParams,
}

#[event]
pub struct TierSet {
    pub tier: u8,
    pub pot_base: u64,
    pub per_card_cap_base: u64,
    pub enabled: bool,
}

#[event]
pub struct PausedSet {
    pub paused: bool,
}

#[event]
pub struct MatchCreated {
    pub match_id: [u8; 32],
    pub creator: Pubkey,
    pub challenger: Pubkey,
    pub tier: u8,
    pub pot_base: u64,
    pub deck_hash: [u8; 32],
    pub deck_size: u8,
    pub join_deadline_sec: i64,
}

#[event]
pub struct MatchJoined {
    pub match_id: [u8; 32],
    pub challenger: Pubkey,
    pub pot_base: u64,
    pub reveal_deadline_sec: i64,
}

#[event]
pub struct DeckRevealed {
    pub match_id: [u8; 32],
    pub policy_version: u32,
    pub cards: Vec<Pubkey>,
    pub pick_deadline_sec: i64,
}

#[event]
pub struct PickFilled {
    pub match_id: [u8; 32],
    pub player: Pubkey,
    pub market: Pubkey,
    pub card_index: u8,
    pub outcome: u8,
    /// Contracts, in raw units (`lots × lot_base`).
    pub quantity_raw: u64,
    pub cost_base: u64,
    pub refund_base: u64,
}

#[event]
pub struct CardSettled {
    pub match_id: [u8; 32],
    pub player: Pubkey,
    pub market: Pubkey,
    pub card_index: u8,
    pub payout_base: u64,
    pub pnl_base: i64,
}

#[event]
pub struct PicksLocked {
    pub match_id: [u8; 32],
    pub status: MatchStatus,
    /// The seat that never finished; the default key when both did.
    pub forfeited_by: Pubkey,
}

#[event]
pub struct MatchFinalized {
    pub match_id: [u8; 32],
    /// The default key for a tie.
    pub winner: Pubkey,
    pub creator_pnl_base: i64,
    pub challenger_pnl_base: i64,
    pub pot_awarded_base: u64,
}

#[event]
pub struct MatchRefunded {
    pub match_id: [u8; 32],
    pub reason: RefundReason,
    pub per_player_base: u64,
}

#[event]
pub struct CreditClaimed {
    pub player: Pubkey,
    pub amount_base: u64,
    pub by: Pubkey,
}

/// `agent` is the default key for a revocation.
#[event]
pub struct AgentAuthorized {
    pub match_id: [u8; 32],
    pub player: Pubkey,
    pub agent: Pubkey,
    pub expires_at_sec: i64,
    pub budget_base: u64,
}

/// What a key never spent, back in its player's credit.
#[event]
pub struct AgentReleased {
    pub match_id: [u8; 32],
    pub player: Pubkey,
    pub amount_base: u64,
}

#[event]
pub struct SeasonCreated {
    pub season: Pubkey,
    pub season_id: String,
    pub ends_at_sec: i64,
}

#[event]
pub struct SeasonDeposited {
    pub season: Pubkey,
    pub from: Pubkey,
    pub amount_base: u64,
    pub balance_base: u64,
}

#[event]
pub struct SeasonDistributed {
    pub season: Pubkey,
    pub total_base: u64,
    pub winners: u8,
}

#[event]
pub struct SeasonRemainderWithdrawn {
    pub season: Pubkey,
    pub amount_base: u64,
}
