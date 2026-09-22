//! `DeskRef` PDA `["desk-ref", mint]` (desk.md §2–§3): the venue's attested price of one PreStocks name, shared by
//! every desk. Permissionlessly initialised and posted; only the admin sets the optional Pyth feed id.

use anchor_lang::prelude::*;

/// 168 B struct, 176 B account.
#[account(zero_copy)]
pub struct DeskRef {
    pub mint: Pubkey,
    /// Pyth `Equity.Index.<NAME>/USD` feed id; zero until the admin sets it.
    pub pyth_feed_id: [u8; 32],
    /// PreStocks `tokenPrice` per UI token × 10^8.
    pub token_price_e8: u64,
    /// PreStocks `markPrice` (the SPV's valuation per token) × 10^8.
    pub mark_price_e8: u64,
    /// The mint's ScaledUiAmount multiplier × 10^12, floored, as the attestor read it.
    pub multiplier_e12: u64,
    /// When the attestor fetched the catalogue; 0 = never posted.
    pub fetched_at_sec: i64,
    pub posted_by: Pubkey,
    pub bump: u8,
    pub _pad: [u8; 7],
    pub _reserved: [u8; 32],
}

impl DeskRef {
    pub fn has_feed(&self) -> bool {
        self.pyth_feed_id != [0u8; 32]
    }
}
