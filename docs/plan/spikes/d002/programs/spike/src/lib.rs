//! D-002 spike: one instruction per oracle crate so each verifier is linked into the SBF build.
use anchor_lang::prelude::*;

#[cfg(feature = "pyth")]
pub mod pyth_settle;
#[cfg(feature = "redstone")]
pub mod redstone_settle;
#[cfg(feature = "switchboard")]
pub mod sb_settle;

declare_id!("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS");

// getrandom 0.2 (via switchboard-on-demand -> libsecp256k1 -> rand) has no SBF backend;
// register one that always fails so the crate compiles. Nothing on-chain calls it.
#[cfg(all(feature = "switchboard", target_os = "solana"))]
mod sbf_getrandom {
    fn unsupported(_buf: &mut [u8]) -> Result<(), getrandom::Error> {
        Err(getrandom::Error::UNSUPPORTED)
    }
    getrandom::register_custom_getrandom!(unsupported);
}

#[program]
pub mod spike {
    use super::*;

    /// Pyth: accept a Full-verified PriceUpdateV2 whose window covers the boundary T (seconds):
    /// prev_publish_time < T <= publish_time.
    pub fn settle_pyth(ctx: Context<SettlePyth>, feed_id: [u8; 32], boundary_ts: i64) -> Result<()> {
        #[cfg(feature = "pyth")]
        {
            let (price, expo) = pyth_settle::price_at(&ctx.accounts.price_update, &feed_id, boundary_ts)?;
            msg!("pyth price {} e{}", price, expo);
            Ok(())
        }
        #[cfg(not(feature = "pyth"))]
        {
            let _ = (ctx, feed_id, boundary_ts);
            err!(SpikeError::Disabled)
        }
    }

    /// RedStone: verify a signed payload against the caller-supplied boundary T (ms), not Clock.
    pub fn settle_redstone(
        ctx: Context<SettleRedstone>,
        feed_id: [u8; 32],
        boundary_ms: u64,
        payload: Vec<u8>,
    ) -> Result<()> {
        msg!("collateral decimals {}", ctx.accounts.collateral_mint.decimals);
        #[cfg(feature = "redstone")]
        {
            let value = redstone_settle::verify_at(feed_id, boundary_ms, payload)?;
            msg!("redstone value(be) {:?}", &value[24..]);
            Ok(())
        }
        #[cfg(not(feature = "redstone"))]
        {
            let _ = (feed_id, boundary_ms, payload);
            err!(SpikeError::Disabled)
        }
    }

    /// Switchboard: verify an ed25519 quote at absolute instruction index `ed_idx`.
    pub fn settle_switchboard(ctx: Context<SettleSwitchboard>, ed_idx: u16, feed_id: [u8; 32]) -> Result<()> {
        #[cfg(feature = "switchboard")]
        {
            let a = &ctx.accounts;
            let (value, slot) = sb_settle::verify_single_feed(
                &a.instructions.to_account_info(),
                &a.queue.to_account_info(),
                &a.slothashes.to_account_info(),
                ed_idx,
                &feed_id,
                2,
                150,
            )?;
            msg!("switchboard value {} slot {}", value, slot);
            Ok(())
        }
        #[cfg(not(feature = "switchboard"))]
        {
            let _ = (ctx, ed_idx, feed_id);
            err!(SpikeError::Disabled)
        }
    }
}

#[cfg(feature = "pyth")]
#[derive(Accounts)]
pub struct SettlePyth<'info> {
    /// Owner is checked against the receiver program ID baked into the SDK (default vs pro-compatible).
    pub price_update: Account<'info, pyth_solana_receiver_sdk::price_update::PriceUpdateV2>,
}

#[cfg(not(feature = "pyth"))]
#[derive(Accounts)]
pub struct SettlePyth<'info> {
    /// CHECK: pyth feature disabled
    pub price_update: UncheckedAccount<'info>,
}

#[derive(Accounts)]
pub struct SettleRedstone<'info> {
    pub keeper: Signer<'info>,
    /// anchor-spl token-interface account, so anchor-spl is linked into the SBF build too
    pub collateral_mint: InterfaceAccount<'info, anchor_spl::token_interface::Mint>,
}

#[derive(Accounts)]
pub struct SettleSwitchboard<'info> {
    /// CHECK: address pinned by the caller in production; unchecked in the spike
    pub queue: UncheckedAccount<'info>,
    /// CHECK: slothashes sysvar
    #[account(address = pubkey!("SysvarS1otHashes111111111111111111111111111"))]
    pub slothashes: UncheckedAccount<'info>,
    /// CHECK: instructions sysvar
    #[account(address = pubkey!("Sysvar1nstructions1111111111111111111111111"))]
    pub instructions: UncheckedAccount<'info>,
}

#[error_code]
pub enum SpikeError {
    #[msg("oracle feature disabled in this build")]
    Disabled,
    #[msg("pyth update not fully verified")]
    PythUnverified,
    #[msg("pyth update window does not cover boundary")]
    PythWindow,
    #[msg("redstone payload timestamp != boundary")]
    RedstoneTimestamp,
    #[msg("redstone feed missing or below signer threshold")]
    RedstoneFeed,
    #[msg("switchboard quote rejected")]
    BadQuote,
}
