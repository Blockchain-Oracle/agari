//! RedStone signed-package prints (prints.md §4.2). A strict pre-parse bounds the payload before any crypto; the
//! SDK then recovers every signer with `threshold = N` (the posted count), so every posted package must be a valid,
//! distinct, authorised signature and `signers` is exact. Anti-selection (PD-1): inside `strict_sec` a poster must
//! present every configured signer, so nobody can choose a favourable subset while the honest relay posts all five.

use redstone::{
    core::{config::Config, process_payload},
    network::error::Error as SdkError,
    solana::{SolanaCrypto, SolanaRedStoneConfig},
    FeedId, SignerAddress,
};

use super::{PrintError, RawPrint};

pub const PACKAGE_LEN: usize = 142;
/// `package_count[2] ‖ unsigned_metadata_size[3] ‖ marker[9]`.
pub const TRAILER_LEN: usize = 14;
pub const MARKER: [u8; 9] = [0x00, 0x00, 0x02, 0xed, 0x57, 0x01, 0x1e, 0x00, 0x00];
pub const VALUE_SIZE: u32 = 32;
/// Offsets inside one package.
const TS_AT: usize = 64;
const VALUE_SIZE_AT: usize = 70;
const POINT_COUNT_AT: usize = 74;

/// The config fields a RedStone print reads: the authorised 20-byte signers and the liveness threshold.
#[derive(Debug, Clone, Copy)]
pub struct RedStoneSigners<'a> {
    /// `config.redstone_signers[..redstone_signer_count]`.
    pub signers: &'a [[u8; 20]],
    /// `config.redstone_threshold` (≥ 1, ≤ `signers.len()`).
    pub threshold: u8,
}

/// The policy fields a RedStone print needs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RedStonePolicy {
    /// ASCII feed id, left-aligned and zero-padded (`b"TSLA"` + 28 zeros).
    pub feed_id: [u8; 32],
    pub strict_sec: u32,
}

fn be(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0u64, |acc, b| (acc << 8) | u64::from(*b))
}

/// Step 1 (no crypto): marker, empty unsigned metadata, `1 ≤ N ≤ signer_count`, exact length, and every package
/// single-feed with a 32-byte value. Returns N. This bounds heap and CU and keeps the SDK off its panic paths.
pub fn preparse(payload: &[u8], signer_count: usize) -> Result<usize, PrintError> {
    let len = payload.len();
    if len < TRAILER_LEN || payload[len - 9..] != MARKER || be(&payload[len - 12..len - 9]) != 0 {
        return Err(PrintError::BadRedStonePackage);
    }
    let n = be(&payload[len - 14..len - 12]) as usize;
    if n == 0 || n > signer_count || len != PACKAGE_LEN * n + TRAILER_LEN {
        return Err(PrintError::BadRedStonePackage);
    }
    for package in payload[..PACKAGE_LEN * n].chunks_exact(PACKAGE_LEN) {
        if be(&package[POINT_COUNT_AT..POINT_COUNT_AT + 3]) != 1 || be(&package[VALUE_SIZE_AT..VALUE_SIZE_AT + 4]) != u64::from(VALUE_SIZE) {
            return Err(PrintError::BadRedStonePackage);
        }
    }
    Ok(n)
}

fn map_sdk_error(error: &SdkError) -> PrintError {
    match error {
        SdkError::TimestampTooOld(..) | SdkError::TimestampTooFuture(..) | SdkError::TimestampDifferentThanOthers(..) => {
            PrintError::RedStoneTimestampMismatch
        }
        _ => PrintError::BadRedStonePackage,
    }
}

/// prints.md §4.2, in order: pre-parse → feed ids → package timestamps `== T·1000` → required signer count →
/// SDK recovery with `threshold = N` → defence-in-depth timestamp/feed → value bounds. Output `(v, −8, T, N)`.
pub fn verify_redstone(payload: &[u8], policy: &RedStonePolicy, cfg: RedStoneSigners<'_>, t: i64, now: i64) -> Result<RawPrint, PrintError> {
    let n = preparse(payload, cfg.signers.len())?;
    let packages = payload[..PACKAGE_LEN * n].chunks_exact(PACKAGE_LEN);
    if packages.clone().any(|p| p[..32] != policy.feed_id) {
        return Err(PrintError::FeedIdMismatch);
    }
    let t_ms = u64::try_from(t).ok().and_then(|t| t.checked_mul(1_000)).ok_or(PrintError::RedStoneTimestampMismatch)?;
    if packages.clone().any(|p| be(&p[TS_AT..TS_AT + 6]) != t_ms) {
        return Err(PrintError::RedStoneTimestampMismatch);
    }
    let strict_until = t.checked_add(i64::from(policy.strict_sec)).ok_or(PrintError::InsufficientRedStoneSigners)?;
    let required = if now < strict_until { cfg.signers.len() } else { usize::from(cfg.threshold) };
    if n < required {
        return Err(PrintError::InsufficientRedStoneSigners);
    }

    let signers: Vec<SignerAddress> = cfg.signers.iter().map(|s| SignerAddress::from(s.to_vec())).collect();
    let threshold = u8::try_from(n).map_err(|_| PrintError::BadRedStonePackage)?;
    let config = Config::try_new(threshold, signers, vec![FeedId::from(policy.feed_id)], t_ms.into(), Some(0.into()), Some(0.into()))
        .map_err(|e| map_sdk_error(&e))?;
    let mut rs: SolanaRedStoneConfig = (config, SolanaCrypto).into();
    // The SDK skips unknown signers, failed recoveries and zero values, dropping the feed below N (empty values);
    // a repeated signer is `ReoccurringFeedId` → the whole print is refused (D-007).
    let validated = process_payload(&mut rs, payload.to_vec()).map_err(|e| map_sdk_error(&e))?;
    let value = validated.values.first().ok_or(PrintError::InsufficientRedStoneSigners)?;
    if validated.timestamp.as_millis() != t_ms || value.feed.to_array() != policy.feed_id {
        return Err(PrintError::BadRedStonePackage);
    }

    let v = value.value.0;
    if v[..24] != [0u8; 24] {
        return Err(PrintError::InvalidPrintValue);
    }
    let low = u64::from_be_bytes(v[24..].try_into().map_err(|_| PrintError::InvalidPrintValue)?);
    if low == 0 || low > i64::MAX as u64 {
        return Err(PrintError::InvalidPrintValue);
    }
    Ok(RawPrint { price: low as i64, expo: -8, source_ts: t, signers: threshold })
}

#[cfg(test)]
mod tests;
