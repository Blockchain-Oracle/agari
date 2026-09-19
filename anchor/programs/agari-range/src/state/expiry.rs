use anchor_lang::prelude::*;

/// How much of the reserve is committed to rounds that all settle at the same instant.
///
/// The global exposure cap bounds the whole book, but it says nothing about *when* the book comes due. Without
/// this, every open round could sit on one 15:00 boundary: one print would then decide the reserve's entire
/// position, which is the concentration the per-expiry cap exists to prevent. Keyed by the boundary rather than
/// by the Window, because two Series expiring together are one risk.
#[account]
#[derive(InitSpace)]
pub struct ExpiryBook {
    pub reserve: Pubkey,
    pub expiry_sec: i64,
    /// Provider capital committed to open rounds settling at this boundary.
    pub locked_base: u64,
    pub rounds_open: u64,
    pub bump: u8,
}
