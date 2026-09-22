//! The attested reference (desk.md §3), the pure part: the 114-byte message an attestor signs, the checks a post
//! must pass, and the optional Pyth index leg (§4.5 step 8). The instruction handlers own the sysvar loading; the
//! ed25519 precompile has already verified the signature, or the transaction would have failed.

use agari_common::print::attested::parse_ed25519_len;
use agari_common::print::pyth::PythUpdateView;
use anchor_lang::prelude::*;

use crate::constants::{PYTH_MAX_AGE_SEC, REFERENCE_FUTURE_SLACK_SEC, REFERENCE_MAX_AGE_SEC, REF_DOMAIN, REF_MESSAGE_LEN};
use crate::errors::DeskError;

/// Every field the signed message binds (integers little-endian).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RefFields {
    pub program_id: Pubkey,
    pub cluster_tag: u8,
    pub mint: Pubkey,
    pub token_price_e8: u64,
    pub mark_price_e8: u64,
    pub multiplier_e12: u64,
    pub fetched_at_sec: i64,
}

/// `"agari-desk-ref-v1" ‖ program_id ‖ cluster_tag ‖ mint ‖ token_price_e8 ‖ mark_price_e8 ‖ multiplier_e12 ‖ fetched_at_sec`.
pub fn ref_message(f: &RefFields) -> [u8; REF_MESSAGE_LEN] {
    let mut m = [0u8; REF_MESSAGE_LEN];
    let mut at = 0;
    let mut put = |bytes: &[u8]| {
        m[at..at + bytes.len()].copy_from_slice(bytes);
        at += bytes.len();
    };
    put(REF_DOMAIN);
    put(f.program_id.as_ref());
    put(&[f.cluster_tag]);
    put(f.mint.as_ref());
    put(&f.token_price_e8.to_le_bytes());
    put(&f.mark_price_e8.to_le_bytes());
    put(&f.multiplier_e12.to_le_bytes());
    put(&f.fetched_at_sec.to_le_bytes());
    m
}

/// §3 in order: the precompile instruction (`BadAttestation`), attestor membership (`UnknownAttestor`), byte-for-byte
/// message equality (`BadAttestation`), positive figures (`InvalidReference`), `now − 900 ≤ fetched_at ≤ now + 5`
/// (`ReferenceStale`), strictly newer than the last post (`ReferenceNotMonotonic`).
pub fn verify_reference(fields: &RefFields, attestors: &[Pubkey], ed25519: (&Pubkey, &[u8], u16), previous_fetched_at_sec: i64, now: i64) -> Result<()> {
    let signed = parse_ed25519_len(ed25519.0, ed25519.1, ed25519.2, REF_MESSAGE_LEN).map_err(|_| DeskError::BadAttestation)?;
    require!(signed.pubkey != [0u8; 32] && attestors.iter().any(|a| a.to_bytes() == signed.pubkey), DeskError::UnknownAttestor);
    require!(signed.message == ref_message(fields), DeskError::BadAttestation);
    require!(fields.token_price_e8 > 0 && fields.mark_price_e8 > 0 && fields.multiplier_e12 > 0, DeskError::InvalidReference);
    let earliest = now.checked_sub(REFERENCE_MAX_AGE_SEC).ok_or(DeskError::MathOverflow)?;
    let latest = now.checked_add(REFERENCE_FUTURE_SLACK_SEC).ok_or(DeskError::MathOverflow)?;
    require!(earliest <= fields.fetched_at_sec && fields.fetched_at_sec <= latest, DeskError::ReferenceStale);
    require!(fields.fetched_at_sec > previous_fetched_at_sec, DeskError::ReferenceNotMonotonic);
    Ok(())
}

/// Whether a posted reference is fresh enough for an operator trade (§4.5 step 7).
pub fn require_fresh(fetched_at_sec: i64, now: i64) -> Result<()> {
    require!(fetched_at_sec > 0, DeskError::ReferenceUnavailable);
    require!(now.saturating_sub(fetched_at_sec) <= REFERENCE_MAX_AGE_SEC, DeskError::ReferenceStale);
    Ok(())
}

/// The Pyth `Equity.Index` price normalised to E8 (§4.5 step 8): fully verified, this name's feed, positive, at most
/// 60 s old and not from the future. Pyth's pre-IPO indices publish at expo −5; any expo in −18..=0 is normalised.
pub fn pyth_index_e8(update: &PythUpdateView, feed_id: &[u8; 32], now: i64) -> Result<u64> {
    require!(update.fully_verified, DeskError::PythIndexInvalid);
    require!(*feed_id != [0u8; 32] && update.feed_id == *feed_id, DeskError::PythIndexInvalid);
    require!(update.price > 0, DeskError::PythIndexInvalid);
    require!(update.publish_time <= now.saturating_add(REFERENCE_FUTURE_SLACK_SEC), DeskError::PythIndexInvalid);
    require!(now.saturating_sub(update.publish_time) <= PYTH_MAX_AGE_SEC, DeskError::PythIndexInvalid);
    require!((-18..=0).contains(&update.exponent), DeskError::PythIndexInvalid);
    let price = u128::try_from(update.price).map_err(|_| DeskError::PythIndexInvalid)?;
    let shift = 8 + update.exponent;
    let e8 = if shift >= 0 {
        price.checked_mul(10u128.pow(shift as u32)).ok_or(DeskError::MathOverflow)?
    } else {
        price / 10u128.pow((-shift) as u32)
    };
    require!(e8 > 0, DeskError::PythIndexInvalid);
    u64::try_from(e8).map_err(|_| DeskError::MathOverflow.into())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;
    use std::str::FromStr;

    fn vector() -> (RefFields, Vec<u8>) {
        let text = std::fs::read_to_string(format!("{}/../../tests/vectors/desk/reference-message.json", env!("CARGO_MANIFEST_DIR"))).unwrap();
        let v: Value = serde_json::from_str(&text).unwrap();
        let f = &v["fields"];
        let s = |k: &str| f[k].as_str().unwrap().to_string();
        let fields = RefFields {
            program_id: Pubkey::from_str(&s("programId")).unwrap(),
            cluster_tag: f["clusterTag"].as_u64().unwrap() as u8,
            mint: Pubkey::from_str(&s("mint")).unwrap(),
            token_price_e8: s("tokenPriceE8").parse().unwrap(),
            mark_price_e8: s("markPriceE8").parse().unwrap(),
            multiplier_e12: s("multiplierE12").parse().unwrap(),
            fetched_at_sec: s("fetchedAtSec").parse().unwrap(),
        };
        let hex = v["hex"].as_str().unwrap();
        let bytes = (0..hex.len()).step_by(2).map(|i| u8::from_str_radix(&hex[i..i + 2], 16).unwrap()).collect();
        (fields, bytes)
    }

    #[test]
    fn message_matches_the_shared_vector() {
        let (fields, bytes) = vector();
        assert_eq!(fields.program_id, crate::ID);
        assert_eq!(ref_message(&fields).to_vec(), bytes);
        assert_eq!(bytes.len(), REF_MESSAGE_LEN);
    }

    #[test]
    fn pyth_index_normalises_expo_and_refuses_the_rest() {
        let now = 1_790_000_000;
        let ok = PythUpdateView { fully_verified: true, feed_id: [7; 32], price: 100_300_000, conf: 1, exponent: -5, publish_time: now - 10, prev_publish_time: now - 12 };
        assert_eq!(pyth_index_e8(&ok, &[7; 32], now).unwrap(), 100_300_000_000);
        assert_eq!(pyth_index_e8(&PythUpdateView { exponent: -8, price: 5, ..ok }, &[7; 32], now).unwrap(), 5);
        assert_eq!(pyth_index_e8(&PythUpdateView { exponent: -10, price: 500, ..ok }, &[7; 32], now).unwrap(), 5);
        assert!(pyth_index_e8(&PythUpdateView { fully_verified: false, ..ok }, &[7; 32], now).is_err());
        assert!(pyth_index_e8(&ok, &[8; 32], now).is_err());
        assert!(pyth_index_e8(&ok, &[0; 32], now).is_err());
        assert!(pyth_index_e8(&PythUpdateView { price: 0, ..ok }, &[7; 32], now).is_err());
        assert!(pyth_index_e8(&PythUpdateView { publish_time: now - 61, ..ok }, &[7; 32], now).is_err());
        assert!(pyth_index_e8(&PythUpdateView { publish_time: now + 6, ..ok }, &[7; 32], now).is_err());
    }

    #[test]
    fn freshness() {
        assert!(require_fresh(0, 1_000).is_err());
        assert!(require_fresh(100, 100 + REFERENCE_MAX_AGE_SEC).is_ok());
        assert!(require_fresh(100, 101 + REFERENCE_MAX_AGE_SEC).is_err());
    }
}
