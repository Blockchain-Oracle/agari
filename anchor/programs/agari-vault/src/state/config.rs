//! `VaultConfig` PDA `["vault-config"]` (vault.md §2).

use anchor_lang::prelude::*;

/// 208 B struct, 216 B account.
#[account(zero_copy)]
pub struct VaultConfig {
    /// The program upgrade authority at init.
    pub admin: Pubkey,
    /// agari-events `GlobalConfig`.
    pub events_config: Pubkey,
    /// = `events_config.collateral_mint` at init.
    pub collateral_mint: Pubkey,
    /// The `["seat"]` PDA: engine authority and custody owner.
    pub seat: Pubkey,
    /// The id the next grant must take; starts at 1 (0 = attended).
    pub next_grant_id: u64,
    pub seat_bump: u8,
    pub bump: u8,
    pub _pad: [u8; 6],
    pub _reserved: [u8; 64],
}
