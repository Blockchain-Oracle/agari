use anchor_lang::prelude::*;

/// The reserve's tunables, mirrored by `RangeParams` in `packages/core/src/range/types.ts`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug, Default)]
pub struct RangeParams {
    /// The reserve's edge over fair value, in basis points.
    pub margin_bps: u16,
    /// The most of the reserve's equity that may back open rounds at once.
    pub max_exposure_bps: u16,
    /// The venue mark must sit inside this band, × 1e6: a book with no trades yet prices nothing.
    pub min_center_q_e6: u32,
    pub max_center_q_e6: u32,
    /// Refuse a round the reserve would barely be paid for, or one it is nearly certain to lose.
    pub min_prob_raw: u64,
    pub max_prob_raw: u64,
    /// A Window with less than this left is not worth pricing; one further out than `max_horizon_sec` is guesswork.
    pub min_time_left_sec: u32,
    pub max_horizon_sec: u32,
    /// A venue mark older than this is not a mark. Measured from the Window's last trade.
    pub stale_after_sec: u32,
    /// The largest payout one round may promise.
    pub max_payout_cap_base: u64,
    /// The house's per-√second volatility for the asset, × 1e8.
    pub sigma_e8: u64,
    /// The most provider capital that may come due at any one boundary.
    pub max_expiry_locked_base: u64,
}

/// The reserve's balance sheet and its liquidity providers' claim on it.
///
/// Two counters carry the whole accounting, and each has one meaning:
///
/// - `user_escrow_base` is money in the vault that is **not** the providers': the stakes of rounds still open,
///   plus the full payout of rounds that have won and not been claimed.
/// - `locked_base` is the providers' own capital committed to open rounds — `max_payout − stake` summed.
///
/// Provider equity is therefore `vault balance − user_escrow_base`, which does not move when a round opens
/// (the vault and the escrow rise by the same stake) and moves by exactly the right amount when one resolves.
/// What they may withdraw is that equity less `locked_base`, because the rest is backing live promises.
#[account]
#[derive(InitSpace)]
pub struct Reserve {
    pub admin: Pubkey,
    pub collateral_mint: Pubkey,
    /// The engine whose Windows this reserve prices. A Market owned by anything else is not a Window.
    pub events_program: Pubkey,
    pub params: RangeParams,
    /// Vault money owed to round owners rather than to providers.
    pub user_escrow_base: u64,
    /// Provider capital backing open rounds.
    pub locked_base: u64,
    pub supply_shares: u64,
    pub next_round_id: u64,
    pub rounds_open: u64,
    pub paused: bool,
    pub bump: u8,
    pub vault_bump: u8,
}

impl Reserve {
    /// What the providers own: everything in the vault that is not already somebody else's.
    pub fn equity_base(&self, vault_balance: u64) -> u64 {
        vault_balance.saturating_sub(self.user_escrow_base)
    }

    /// What a provider may withdraw, or the reserve may commit to a new round.
    pub fn free_base(&self, vault_balance: u64) -> u64 {
        self.equity_base(vault_balance).saturating_sub(self.locked_base)
    }
}
