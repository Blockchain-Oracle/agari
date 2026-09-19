use anchor_lang::prelude::*;

/// What the vault will and will not do with its providers' money, mirrored by `MakerParams` in
/// `packages/core/src/maker/types.ts`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug, Default)]
pub struct MakerParams {
    /// The most of the vault's value that may sit in the venue at once.
    pub max_exposure_bps: u16,
    /// A quote tighter than this is not a quote, it is a gift.
    pub min_spread_ticks: u16,
    /// The band the vault will quote inside; outside it the edge stops covering the rounding.
    pub min_price_ticks: u16,
    pub max_price_ticks: u16,
    /// Per-quote and per-Window ceilings, so one Window cannot take the book.
    pub max_quantity_lots: u64,
    pub max_window_deployed_base: u64,
    pub max_open_windows: u16,
    /// A Window with less than this left is not worth quoting into.
    pub min_time_left_sec: u32,
}

/// The vault's balance sheet and who is allowed to quote it.
///
/// `deployed_base` is capital the venue holds against live quotes and positions; everything else is idle in
/// custody. Share price is total value over shares, and total value is custody plus deployed — so a provider's
/// claim does not jump when the maker quotes, only when a Window settles for or against the vault.
#[account]
#[derive(InitSpace)]
pub struct MakerVault {
    pub admin: Pubkey,
    /// The one actor allowed to quote and pull. Providers' money, one hand on it.
    pub maker: Pubkey,
    pub collateral_mint: Pubkey,
    pub events_program: Pubkey,
    pub venue_config: Pubkey,
    pub params: MakerParams,
    /// Capital the venue holds for the vault: escrow out, less what has come back.
    pub deployed_base: u64,
    pub supply_shares: u64,
    pub open_windows: u16,
    pub paused: bool,
    pub bump: u8,
    pub custody_bump: u8,
    pub seat_bump: u8,
}

impl MakerVault {
    /// Custody plus what the venue holds: what the providers own between settlements.
    pub fn total_value_base(&self, custody_balance: u64) -> u64 {
        custody_balance.saturating_add(self.deployed_base)
    }
}
