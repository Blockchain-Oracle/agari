use anchor_lang::prelude::*;

/// The reserve's tunables, mirrored by `ParlayParams` in `packages/core/src/parlay/types.ts`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug, Default)]
pub struct ParlayParams {
    pub margin_bps: u16,
    pub max_exposure_bps: u16,
    /// The floor a correlated combination is held to, as a fraction of the cheapest leg.
    pub correlation_bps: u16,
    pub max_legs: u8,
    pub min_legs: u8,
    pub max_payout_cap_base: u64,
    pub max_expiry_locked_base: u64,
    pub min_combined_prob_raw: u64,
    /// The depth a leg is priced over: a price taken off the top of book alone is not a price.
    pub price_depth_lots: u64,
    pub min_time_left_sec: u32,
}

/// The reserve's balance sheet, kept on the same two counters as the range reserve and for the same reason:
/// `user_escrow_base` is vault money that is not the providers', `locked_base` is provider capital committed.
#[account]
#[derive(InitSpace)]
pub struct ParlayReserve {
    pub admin: Pubkey,
    pub collateral_mint: Pubkey,
    pub events_program: Pubkey,
    pub venue_config: Pubkey,
    pub params: ParlayParams,
    pub user_escrow_base: u64,
    pub locked_base: u64,
    pub supply_shares: u64,
    pub next_parlay_id: u64,
    pub tickets_open: u64,
    pub paused: bool,
    pub bump: u8,
    pub vault_bump: u8,
}

impl ParlayReserve {
    pub fn equity_base(&self, vault_balance: u64) -> u64 {
        vault_balance.saturating_sub(self.user_escrow_base)
    }

    pub fn free_base(&self, vault_balance: u64) -> u64 {
        self.equity_base(vault_balance).saturating_sub(self.locked_base)
    }
}

#[account]
#[derive(InitSpace)]
pub struct Provider {
    pub reserve: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    pub supplied_base: u64,
    pub withdrawn_base: u64,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum LegStatus {
    Pending,
    Won,
    Lost,
    Void,
}

/// One leg, frozen at open: the Window, the side, the price it was bought at, and when it decides.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug)]
pub struct ParlayLeg {
    pub market: Pubkey,
    /// True for a call that the close is above the open.
    pub is_up: bool,
    pub status: LegStatus,
    pub expiry_sec: i64,
    /// Collateral per whole contract of the chosen side at open — this leg's priced win probability.
    pub price_raw: u64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum ParlayStatus {
    Live,
    Won,
    Lost,
    Void,
    Claimed,
}

/// One multi-leg ticket against the reserve.
///
/// Legs are resolved one at a time and permissionlessly, because their Windows settle at different moments and
/// nobody should have to wait for the last one to learn the first went against them. The ticket itself only
/// finishes when every leg has an answer — or the moment one is lost, which is the whole shape of a parlay.
#[account]
#[derive(InitSpace)]
pub struct ParlayTicket {
    pub reserve: Pubkey,
    pub owner: Pubkey,
    pub parlay_id: u64,
    pub status: ParlayStatus,
    pub leg_count: u8,
    pub won_count: u8,
    pub void_count: u8,
    #[max_len(8)]
    pub legs: Vec<ParlayLeg>,
    pub opened_at_sec: i64,
    pub settled_at_sec: i64,
    /// The latest boundary any leg settles on; the ticket's own expiry for the stale sweep.
    pub last_expiry_sec: i64,
    pub stake_base: u64,
    pub max_payout_base: u64,
    pub house_locked_base: u64,
    pub combined_prob_raw: u64,
    pub bump: u8,
}

impl ParlayTicket {
    /// Every leg has an answer, so the ticket can be closed.
    pub fn all_decided(&self) -> bool {
        self.legs.iter().all(|leg| leg.status != LegStatus::Pending)
    }
}

/// Capital coming due at one boundary, so a reserve cannot put its whole book on a single print.
#[account]
#[derive(InitSpace)]
pub struct ExpiryBook {
    pub reserve: Pubkey,
    pub expiry_sec: i64,
    pub locked_base: u64,
    pub tickets_open: u64,
    pub bump: u8,
}
