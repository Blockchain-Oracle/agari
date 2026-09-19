use anchor_lang::prelude::*;

/// One liquidity provider's claim on the reserve.
///
/// The reserve keeps `supply_shares` as the total, but a total cannot tell one provider from another: without a
/// per-provider record there is nothing to check a withdrawal against, and the first caller could redeem the
/// whole supply. Shares live here, one account per wallet, and only ever move through that wallet's own signature.
#[account]
#[derive(InitSpace)]
pub struct Provider {
    pub reserve: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    /// What this provider has put in and taken out, so a front end can show a return without replaying events.
    pub supplied_base: u64,
    pub withdrawn_base: u64,
    pub bump: u8,
}
