//! `Grant` PDA `["grant", grant_id u64 LE]` (vault.md §2, §4): a bounded power an owner gives an actor. Caps are
//! u64 base units and own-side ticks; `u64::MAX` is Masayume's "no cap" (`type(uint128).max`).

use anchor_lang::prelude::*;

/// 168 B struct, 176 B account. Never closed in S7. `market` (D-091) took the reserved tail before the first deploy.
#[account(zero_copy)]
pub struct Grant {
    pub owner: Pubkey,
    pub actor: Pubkey,
    /// Global and never reused (`VaultConfig.next_grant_id`).
    pub grant_id: u64,
    /// Live while `now ≤ expires_at_sec`.
    pub expires_at_sec: i64,
    /// UTC day (`⌊unix_ts / 86,400⌋`) that `spent_today` belongs to.
    pub spent_day: u64,
    pub spent_today: u64,
    /// What the actor may still spend; proceeds never flow back here.
    pub budget: u64,
    pub max_stake_per_trade: u64,
    pub max_daily_spend: u64,
    pub max_open_positions: u32,
    pub open_positions: u32,
    /// Dearest own-side price in ticks; 0 = no cap.
    pub max_price_ticks: u16,
    /// SESSION 0, EXECUTOR 1, STRATEGY 2.
    pub kind: u8,
    /// 0 live, 1 revoked.
    pub revoked: u8,
    pub bump: u8,
    pub _pad: [u8; 3],
    /// The one Window this grant may trade (D-091); `Pubkey::default()` = any Window. Occupies the former reserve.
    pub market: Pubkey,
}

impl Grant {
    pub const fn is_revoked(&self) -> bool {
        self.revoked != 0
    }
}
