use anchor_lang::prelude::*;
use pyth_solana_receiver_sdk::price_update::{PriceUpdateV2, VerificationLevel};

use crate::SpikeError;

/// Receiver program the `Account<PriceUpdateV2>` owner check is compiled against.
pub const RECEIVER_ID: Pubkey = pyth_solana_receiver_sdk::ID;
pub const PUSH_ORACLE_ID: Pubkey = pyth_solana_receiver_sdk::PYTH_PUSH_ORACLE_ID;

/// Returns (price, exponent) for `feed_id` if the update is Full-verified and
/// prev_publish_time < boundary_ts <= publish_time.
pub fn price_at(update: &PriceUpdateV2, feed_id: &[u8; 32], boundary_ts: i64) -> Result<(i64, i32)> {
    require!(update.verification_level == VerificationLevel::Full, SpikeError::PythUnverified);
    let p = update.get_price_unchecked(feed_id)?;
    let m = &update.price_message;
    require!(
        m.prev_publish_time < boundary_ts && boundary_ts <= m.publish_time,
        SpikeError::PythWindow
    );
    Ok((p.price, p.exponent))
}
