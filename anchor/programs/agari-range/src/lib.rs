//! agari-range: Masayume's RangeReserve on Solana (spec mirrored by `packages/core/src/range`).
//!
//! A house-banked bet on where a Window's closing print lands: the buyer names a band and a side, the reserve
//! prices it off the Window's own opening print and book basis, takes a stake and locks the rest of the payout
//! out of its own liquidity. There is no order book here — the reserve is the counterparty to every round.
//!
//! This file is dispatch only; the arithmetic lives in `math`, the balance sheet in `state`.

use anchor_lang::prelude::*;

pub mod errors;
pub mod math;
pub mod state;

declare_id!("GfsAzxPeNp2cbUTrXehHBjLjAMX6Cf69gz2zJYkGM7ha");

#[program]
pub mod agari_range {
    use super::*;

    /// Placeholder dispatch: the instruction set lands with the reserve's state in the next step.
    pub fn noop(_ctx: Context<Noop>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Noop<'info> {
    pub payer: Signer<'info>,
}
