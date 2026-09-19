use anchor_lang::prelude::*;

/// One Window's flow through the vault — the contract's `WindowBook`.
///
/// Kept per Window rather than netted into one number because a vault that cannot say *where* its capital went
/// cannot be audited by the people whose capital it is. `escrow_out − escrow_back − merged − payout` is what the
/// venue still holds for this Window, and the four are only ever added to, so the arithmetic cannot drift.
#[account]
#[derive(InitSpace)]
pub struct WindowBook {
    pub vault: Pubkey,
    pub market: Pubkey,
    pub escrow_out_base: u64,
    pub escrow_back_base: u64,
    pub merged_base: u64,
    pub payout_base: u64,
    pub opened_at_sec: i64,
    pub settled_at_sec: i64,
    pub quote_count: u32,
    pub settled: bool,
    pub bump: u8,
}

impl WindowBook {
    /// What the venue still holds for this Window, floored at zero.
    pub fn deployed_base(&self) -> u64 {
        self.escrow_out_base
            .saturating_sub(self.escrow_back_base)
            .saturating_sub(self.merged_base)
            .saturating_sub(self.payout_base)
    }
}
