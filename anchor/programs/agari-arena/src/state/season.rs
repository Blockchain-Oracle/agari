use anchor_lang::prelude::*;

use crate::constants::MAX_SEASON_ID_LEN;

/// A season's prize, as money that already sits in an account and not a promise on a page. Standings and
/// eligibility live off chain (the ladder the settler writes); this is only the payout rail. Funds leave through one
/// single-shot distribution or the admin's withdrawal of what is left, so the pool can be neither replayed nor
/// over-spent, and nothing is ever stuck. `ends_at_sec` is informational.
#[account]
#[derive(InitSpace)]
pub struct SeasonPool {
    pub admin: Pubkey,
    pub collateral_mint: Pubkey,
    #[max_len(MAX_SEASON_ID_LEN)]
    pub season_id: String,
    pub ends_at_sec: i64,
    /// Set once `admin_distribute_season` runs; blocks a second distribution.
    pub distributed: bool,
    /// Everything ever deposited, so a page can say how the pool was built and not only what is left.
    pub deposited_base: u64,
    pub bump: u8,
    pub vault_bump: u8,
}
