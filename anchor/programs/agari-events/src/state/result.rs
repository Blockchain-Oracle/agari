//! `MarketResult` PDA `["result", market]`: the small, stable settlement record products read (PD-7;
//! events-accounts.md §3.7). Closes with its Market after `result_retention_sec`.

use anchor_lang::prelude::*;

use super::market::Print;

/// 248 B struct, 256 B account.
#[account(zero_copy)]
pub struct MarketResult {
    pub market: Pubkey,
    pub series: Pubkey,
    /// The settler or voider who paid this account's rent, refunded at close.
    pub rent_payer: Pubkey,
    pub open: Print,
    pub close: Print,
    pub check_open: Print,
    pub check_close: Print,
    pub resolved_ts: i64,
    pub payout_yes: u32,
    pub payout_no: u32,
    pub policy_version: u8,
    pub void_reason: u8,
    /// bool: settled on the primary source alone because the check prints missed their window.
    pub single_source: u8,
    pub winner: u8,
    pub bump: u8,
    pub _pad0: [u8; 3],
    pub _reserved: [u8; 32],
}
