//! agari-parlay: Masayume's ParlayReserve on Solana (arithmetic mirrored by `packages/core/src/parlay`).
//!
//! A house-banked ticket over two or more Windows: every leg must come in. The reserve prices each leg off that
//! Window's own book, multiplies them, applies a correlation floor where legs settle on one print, takes a stake
//! and locks the rest of the payout out of its providers' capital.
//!
//! Legs resolve one at a time and permissionlessly, because their Windows settle at different moments and nobody
//! should wait for the last to learn the first went against them.
//!
//! The arithmetic is in `math` and is pinned to the client's golden vectors. The balance sheet is in `state`,
//! on the same two counters the range reserve uses: what is the buyers' and what is the providers'.

use anchor_lang::prelude::*;

pub mod constants;
pub mod errors;
pub mod math;
pub mod state;

declare_id!("H4gdpoPirbtHP6hNdiQRLwfifjshdgDamYuvrGxj2ZCC");

#[program]
pub mod agari_parlay {
    use super::*;

    /// The instruction set lands with the open and resolve steps; the arithmetic and the balance sheet are here.
    pub fn noop(_ctx: Context<Noop>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Noop<'info> {
    pub payer: Signer<'info>,
}
