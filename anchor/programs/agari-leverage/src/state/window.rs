use anchor_lang::prelude::*;

/// What the reserve has out on one Window. PDA `["lwin", market]`. Every boost on one print loses together, so the
/// reserve caps what it fronts per Window as well as overall.
#[account]
#[derive(InitSpace)]
pub struct WindowBook {
    pub market: Pubkey,
    pub fronted_base: u64,
    pub positions_open: u32,
    pub bump: u8,
}
