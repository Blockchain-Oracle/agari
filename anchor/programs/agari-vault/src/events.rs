//! Vault events (vault.md §7), in Borsh order. `admin_init_vault` has no event-CPI accounts and uses `emit!`; every
//! other instruction uses `emit_cpi!`. The indexer builds Masayume's `VaultTally` from `Executed` and `Settled`.

use anchor_lang::prelude::*;

#[event]
pub struct VaultInitialized {
    pub config: Pubkey,
    pub admin: Pubkey,
    pub collateral_mint: Pubkey,
    pub seat: Pubkey,
}

#[event]
pub struct AccountOpened {
    pub owner: Pubkey,
    pub custody: Pubkey,
}

#[event]
pub struct Deposited {
    pub owner: Pubkey,
    pub amount: u64,
    pub available: u64,
}

#[event]
pub struct Withdrawn {
    pub owner: Pubkey,
    pub amount: u64,
    pub available: u64,
}

#[event]
pub struct PrivateMoved {
    pub owner: Pubkey,
    pub amount: u64,
    pub private_available: u64,
}

#[event]
pub struct PrivateWithdrawn {
    pub owner: Pubkey,
    pub amount: u64,
    pub private_available: u64,
}

#[event]
pub struct GrantCreated {
    pub grant_id: u64,
    pub owner: Pubkey,
    pub actor: Pubkey,
    pub kind: u8,
    pub max_stake_per_trade: u64,
    pub max_daily_spend: u64,
    pub max_open_positions: u32,
    pub max_price_ticks: u16,
    pub expires_at_sec: i64,
    pub budget: u64,
}

#[event]
pub struct GrantFunded {
    pub grant_id: u64,
    pub amount: u64,
    pub budget: u64,
}

#[event]
pub struct GrantRevoked {
    pub grant_id: u64,
    pub owner: Pubkey,
    pub returned: u64,
}

/// One IOC through the vault seat. `grant_id` 0 = the owner acting alone; `market` is the Market PDA.
#[event]
pub struct Executed {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub grant_id: u64,
    pub outcome: u8,
    pub is_buy: bool,
    /// Collateral spent (buy) or received (sell).
    pub cash_delta: u64,
    /// Lots gained (buy) or sold (sell).
    pub lots_delta: u64,
    pub actor: Pubkey,
    pub at_sec: i64,
    pub fills: u8,
}

#[event]
pub struct Settled {
    pub owner: Pubkey,
    pub market: Pubkey,
    pub payout: u64,
    pub yes_redeemed: u64,
    pub no_redeemed: u64,
    pub by: Pubkey,
    pub at_sec: i64,
}
