//! Pyth pull prints (prints.md §4.1). The instruction takes `Account<PriceUpdateV2>`, so Anchor's owner check
//! already pins the receiver compiled into `pyth-solana-receiver-sdk` (D-002); this verifies the update itself.

use super::{PrintError, RawPrint};

/// The fields of a posted `PriceUpdateV2` the rule reads (decoupled from the SDK so fixtures test it directly).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PythUpdateView {
    /// `verification_level == Full`.
    pub fully_verified: bool,
    pub feed_id: [u8; 32],
    pub price: i64,
    pub conf: u64,
    pub exponent: i32,
    pub publish_time: i64,
    pub prev_publish_time: i64,
}

/// The policy fields a Pyth print needs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct PythPolicy {
    pub feed_id: [u8; 32],
    pub grace_sec: u16,
    pub max_conf_bps: u16,
}

/// prints.md §4.1, in order:
/// 1. Full verification (`InsufficientVerification`);
/// 2. feed id (`FeedIdMismatch`);
/// 3. `prev_publish_time < T ≤ publish_time ≤ T + grace_sec` (`PrintNotUnique`): exactly one update per feed;
/// 4. `price > 0` (`InvalidPrintValue`);
/// 5. `conf × 10,000 ≤ price × max_conf_bps` in `u128` (`ConfidenceTooWide`): a halted feed's wide band gives no print.
pub fn verify_pyth(update: &PythUpdateView, policy: &PythPolicy, t: i64) -> Result<RawPrint, PrintError> {
    if !update.fully_verified {
        return Err(PrintError::InsufficientVerification);
    }
    if update.feed_id != policy.feed_id {
        return Err(PrintError::FeedIdMismatch);
    }
    let latest = t.checked_add(i64::from(policy.grace_sec)).ok_or(PrintError::PrintNotUnique)?;
    if !(update.prev_publish_time < t && t <= update.publish_time && update.publish_time <= latest) {
        return Err(PrintError::PrintNotUnique);
    }
    if update.price <= 0 {
        return Err(PrintError::InvalidPrintValue);
    }
    // price > 0, so the cast is lossless; both sides stay far below u128::MAX.
    let band = u128::from(update.conf) * 10_000;
    let cap = (update.price as u128) * u128::from(policy.max_conf_bps);
    if band > cap {
        return Err(PrintError::ConfidenceTooWide);
    }
    Ok(RawPrint { price: update.price, expo: update.exponent, source_ts: update.publish_time, signers: 0 })
}

#[cfg(feature = "pyth")]
impl From<&pyth_solana_receiver_sdk::price_update::PriceUpdateV2> for PythUpdateView {
    fn from(u: &pyth_solana_receiver_sdk::price_update::PriceUpdateV2) -> Self {
        let m = &u.price_message;
        Self {
            fully_verified: u.verification_level == pyth_solana_receiver_sdk::price_update::VerificationLevel::Full,
            feed_id: m.feed_id,
            price: m.price,
            conf: m.conf,
            exponent: m.exponent,
            publish_time: m.publish_time,
            prev_publish_time: m.prev_publish_time,
        }
    }
}

#[cfg(test)]
mod tests;
