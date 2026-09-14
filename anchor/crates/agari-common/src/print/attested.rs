//! Attested "demo data" prints (prints.md §4.3), the pure part. The instruction checks the stack height and loads
//! the Instructions sysvar (`load_current_index_checked`, `load_instruction_at_checked(cur − 1)`), then hands the
//! previous instruction's program id and data here. The ed25519 precompile has already verified the signature, or
//! the transaction would have failed; what remains is proving it signed *our* message with *our* attestor.

use anchor_lang::prelude::Pubkey;

use super::{PrintError, RawPrint};

pub const ATTEST_DOMAIN: &[u8; 14] = b"agari-print-v1";
pub const ATTEST_MESSAGE_LEN: usize = 158;
/// `Ed25519SigVerify111111111111111111111111111`.
pub const ED25519_PROGRAM_ID: Pubkey = anchor_lang::pubkey!("Ed25519SigVerify111111111111111111111111111");
/// `num_signatures[1] ‖ padding[1] ‖ offsets[14]`.
const OFFSETS_END: usize = 16;

/// Every field the signed message binds (all integers little-endian).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AttestFields {
    pub program_id: Pubkey,
    pub cluster_tag: u8,
    pub market: Pubkey,
    pub which: u8,
    pub boundary_ts: i64,
    pub price: i64,
    pub expo: i32,
    /// The policy's attested source hash, e.g. `sha256("jupiter-price-v3-median3:TSLAx")`.
    pub feed_id: [u8; 32],
    pub bar_start_ts: i64,
    pub bar_len_sec: u16,
    pub fetched_at_ts: i64,
}

/// The exact 158 B message: `domain ‖ program_id ‖ cluster_tag ‖ market ‖ which ‖ boundary_ts ‖ price ‖ expo ‖
/// source_ts (= T) ‖ feed_id ‖ bar_start_ts ‖ bar_len_sec ‖ fetched_at_ts`.
pub fn attest_message(f: &AttestFields) -> [u8; ATTEST_MESSAGE_LEN] {
    let mut m = [0u8; ATTEST_MESSAGE_LEN];
    let mut at = 0;
    let mut put = |bytes: &[u8]| {
        m[at..at + bytes.len()].copy_from_slice(bytes);
        at += bytes.len();
    };
    put(ATTEST_DOMAIN);
    put(f.program_id.as_ref());
    put(&[f.cluster_tag]);
    put(f.market.as_ref());
    put(&[f.which]);
    put(&f.boundary_ts.to_le_bytes());
    put(&f.price.to_le_bytes());
    put(&f.expo.to_le_bytes());
    put(&f.boundary_ts.to_le_bytes()); // source_ts is T, derived, never an argument
    put(&f.feed_id);
    put(&f.bar_start_ts.to_le_bytes());
    put(&f.bar_len_sec.to_le_bytes());
    put(&f.fetched_at_ts.to_le_bytes());
    m
}

/// The signer key and message the ed25519 instruction at `cur − 1` verified.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Ed25519Signed<'a> {
    pub pubkey: [u8; 32],
    pub message: &'a [u8],
}

fn le16(data: &[u8], at: usize) -> usize {
    usize::from(u16::from_le_bytes([data[at], data[at + 1]]))
}

/// §4.3 steps 4–5: the previous instruction is the ed25519 precompile with exactly one signature whose every
/// offset points into that same instruction (index `cur − 1` or `u16::MAX`: the known offsets attack), all ranges
/// in bounds, and a 158 B message.
pub fn parse_ed25519<'a>(program_id: &Pubkey, data: &'a [u8], current_index: u16) -> Result<Ed25519Signed<'a>, PrintError> {
    if *program_id != ED25519_PROGRAM_ID || current_index == 0 || data.len() < OFFSETS_END || data[0] != 1 {
        return Err(PrintError::BadAttestation);
    }
    let own = usize::from(current_index - 1);
    let (sig_off, sig_ix, key_off, key_ix, msg_off, msg_len, msg_ix) =
        (le16(data, 2), le16(data, 4), le16(data, 6), le16(data, 8), le16(data, 10), le16(data, 12), le16(data, 14));
    let points_here = |ix: usize| ix == own || ix == usize::from(u16::MAX);
    if !(points_here(sig_ix) && points_here(key_ix) && points_here(msg_ix)) || msg_len != ATTEST_MESSAGE_LEN {
        return Err(PrintError::BadAttestation);
    }
    let in_bounds = |off: usize, len: usize| off.checked_add(len).is_some_and(|end| end <= data.len());
    if !(in_bounds(sig_off, 64) && in_bounds(key_off, 32) && in_bounds(msg_off, msg_len)) {
        return Err(PrintError::BadAttestation);
    }
    let mut pubkey = [0u8; 32];
    pubkey.copy_from_slice(&data[key_off..key_off + 32]);
    Ok(Ed25519Signed { pubkey, message: &data[msg_off..msg_off + msg_len] })
}

/// The policy fields an attested print needs.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AttestedPolicy {
    pub feed_id: [u8; 32],
    pub min_delay_sec: u16,
    pub bar_len_sec: u16,
}

/// §4.3 steps 2–8 in order: bar alignment and the correction cutoff (`BadAttestation`), the precompile instruction
/// (`parse_ed25519`), attestor membership (`UnknownAttestor`), byte-for-byte message equality (`BadAttestation`),
/// then `price > 0` and `−18 ≤ expo ≤ 0` (`InvalidPrintValue`). Output `(price, expo, T, 1)`.
pub fn verify_attested(
    fields: &AttestFields,
    policy: &AttestedPolicy,
    attestors: &[Pubkey],
    ed25519: (&Pubkey, &[u8], u16),
    now: i64,
) -> Result<RawPrint, PrintError> {
    let t = fields.boundary_ts;
    if fields.bar_len_sec != policy.bar_len_sec || fields.feed_id != policy.feed_id {
        return Err(PrintError::BadAttestation);
    }
    if Some(fields.bar_start_ts) != t.checked_sub(i64::from(policy.bar_len_sec)) {
        return Err(PrintError::BadAttestation);
    }
    let cutoff = t.checked_add(i64::from(policy.min_delay_sec)).ok_or(PrintError::BadAttestation)?;
    if !(cutoff <= fields.fetched_at_ts && fields.fetched_at_ts <= now) {
        return Err(PrintError::BadAttestation);
    }
    let signed = parse_ed25519(ed25519.0, ed25519.1, ed25519.2)?;
    if signed.pubkey == [0u8; 32] || !attestors.iter().any(|a| a.to_bytes() == signed.pubkey) {
        return Err(PrintError::UnknownAttestor);
    }
    if signed.message != attest_message(fields) {
        return Err(PrintError::BadAttestation);
    }
    if fields.price <= 0 || !(-18..=0).contains(&fields.expo) {
        return Err(PrintError::InvalidPrintValue);
    }
    Ok(RawPrint { price: fields.price, expo: fields.expo, source_ts: t, signers: 1 })
}

#[cfg(test)]
mod tests;
