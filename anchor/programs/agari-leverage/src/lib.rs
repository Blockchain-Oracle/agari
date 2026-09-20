//! agari-leverage: Masayume's LeverageReserve on Solana (arithmetic mirrored by `packages/core/src/leverage`).

use anchor_lang::prelude::*;

pub mod math;

declare_id!("2yMrhq686tL6uAUFHfKGsPZAWSGoQoRW9HxNvnAZJeQb");

#[program]
pub mod agari_leverage {
    use super::*;

    /// The instruction set lands with the state; the arithmetic is here first because it decides the rest.
    pub fn noop(_ctx: Context<Noop>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Noop<'info> {
    pub payer: Signer<'info>,
}
