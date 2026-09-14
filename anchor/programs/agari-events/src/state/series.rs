//! `Series` PDA `["series", ticker u16, cadence_sec u32, basis u8]` (events-accounts.md §3.4).

use anchor_lang::prelude::*;

use super::policy::PolicyVersion;
use crate::constants::{MAX_FREE_BOOKS, MAX_POLICY_VERSIONS};

/// 1,360 B struct, 1,368 B account.
#[account(zero_copy)]
pub struct Series {
    /// Core registry id (`packages/core/src/market/tickers.ts` `seriesId`).
    pub ticker: u16,
    pub basis: u8,
    pub bump: u8,
    /// `GAP_CADENCE_SEC` for the Gap lane (D-013).
    pub cadence_sec: u32,
    pub lot_base: u64,
    pub tick_base: u64,
    pub cash_unit: u64,
    pub min_lots: u64,
    pub seat_bond: u64,
    pub next_index: u64,
    pub last_expiry: i64,
    pub min_rest_slots: u32,
    pub max_lead_sec: u32,
    pub fills_cap: u8,
    pub evictions_cap: u8,
    pub version_count: u8,
    pub free_book_count: u8,
    pub _pad0: [u8; 4],
    pub free_books: [Pubkey; MAX_FREE_BOOKS],
    pub policy_versions: [PolicyVersion; MAX_POLICY_VERSIONS],
    pub _reserved: [u8; 64],
}

impl Series {
    pub fn versions(&self) -> &[PolicyVersion] {
        &self.policy_versions[..usize::from(self.version_count).min(MAX_POLICY_VERSIONS)]
    }

    /// The highest version covering both boundaries: the only one `roller_open_window` accepts (prints.md §2.3).
    pub fn highest_covering_version(&self, trading_start: i64, expiry: i64) -> Option<u8> {
        self.versions().iter().rposition(|v| v.covers(trading_start, expiry)).and_then(|i| u8::try_from(i).ok())
    }

    pub fn free_books(&self) -> &[Pubkey] {
        &self.free_books[..usize::from(self.free_book_count).min(MAX_FREE_BOOKS)]
    }
}
