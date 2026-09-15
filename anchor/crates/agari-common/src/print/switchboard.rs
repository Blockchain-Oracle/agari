//! Switchboard Surge prints for the 24/7 token lane (prints.md §4.4; session-lanes.md §2.2), the pure part. The
//! instruction pins the queue, checks the stack height and loads the Instructions sysvar; these functions prove the
//! ed25519 instruction at `cur − 1` is one Switchboard quote over our feed, signed by enough distinct queue oracles at a
//! slot the cluster still remembers, and turn its `i128 × 10⁻¹⁸` value into an `expo −8` print.
//!
//! Quote instruction data (`@switchboard-xyz/on-demand` 3.10.6, `Ed25519InstructionUtils`):
//! `count u8 ‖ pad u8 ‖ offsets[14]×count ‖ sig[64]×count ‖ pubkey[32]×count ‖ message ‖ oracle_idx u8×count ‖
//! slot u64 ‖ version u8 ‖ "SBOD"`, where `message = signed_slothash[32] ‖ (feed_hash[32] ‖ value i128 ‖ min_samples u8)*`.
//!
//! `QuoteVerifier` (crate 0.13.0) checks slot age, the SlotHashes entry and each signer against the queue, but it
//! `assert!`s on a mismatch (a panic, not an error), reads SlotHashes past its entries, maps `oracle_idx % 30` (so index
//! 30 counts as a second copy of oracle 0) and never dedupes. `check_slothash` and `check_signers` therefore run first
//! with the same meaning and named errors, and `quote_print` dedupes by index **and** signer key.

use anchor_lang::prelude::Pubkey;

use super::attested::ED25519_PROGRAM_ID;
use super::normalize::normalize;
use super::{PrintError, RawPrint};

/// The quote format's own limits (the verifier bails above them).
pub const MAX_QUOTE_SIGNATURES: usize = 8;
pub const MAX_QUOTE_FEEDS: usize = 8;
/// A Switchboard queue account: Anchor discriminator + `QueueAccountData`.
pub const QUEUE_ACCOUNT_LEN: usize = 6_280;
/// `8 + offset_of!(QueueAccountData, ed25519_oracle_signing_keys)`: authority, 32 enclave measurements, 78 oracle keys,
/// 40 reserved bytes and 30 secp256k1 keys precede it (checked against the crate in the tests).
pub const QUEUE_SIGNING_KEYS_OFFSET: usize = 8 + 32 + 32 * 32 + 78 * 32 + 40 + 30 * 20;
pub const QUEUE_SIGNING_KEY_SLOTS: usize = 30;
/// The value scale of a feed result.
pub const SWITCHBOARD_EXPO: i32 = -18;

const OFFSETS_LEN: usize = 14;
const HEADER_LEN: usize = 32;
const FEED_INFO_LEN: usize = 49;
/// `slot u64 ‖ version u8 ‖ discriminator[4]`, after the oracle indices.
const TRAILER_LEN: usize = 13;
const SLOT_HASH_LEN: usize = 40;

fn le16(data: &[u8], at: usize) -> usize {
    usize::from(u16::from_le_bytes([data[at], data[at + 1]]))
}

fn bytes32(data: &[u8], at: usize) -> [u8; 32] {
    let mut out = [0u8; 32];
    out.copy_from_slice(&data[at..at + 32]);
    out
}

/// A bounds-checked view over quote instruction data. Every accessor reads only ranges `parse` proved in bounds, and
/// reads them from the same places the crate's parser does (the first offsets record's message, the trailing indices).
#[derive(Debug, Clone, Copy)]
pub struct QuoteView<'a> {
    data: &'a [u8],
    count: usize,
    message: usize,
    message_len: usize,
    /// Start of the oracle indices: `len − count − 13`.
    suffix: usize,
}

impl<'a> QuoteView<'a> {
    /// `BadAttestation` for any layout the crate parser would read out of bounds or refuse.
    pub fn parse(data: &'a [u8]) -> Result<Self, PrintError> {
        let bad = PrintError::BadAttestation;
        let count = usize::from(*data.first().ok_or(bad)?);
        if count == 0 || count > MAX_QUOTE_SIGNATURES {
            return Err(bad);
        }
        let offsets_end = 2 + count * OFFSETS_LEN;
        let suffix = data.len().checked_sub(count + TRAILER_LEN).ok_or(bad)?;
        if suffix < offsets_end {
            return Err(bad);
        }
        let (message, message_len) = (le16(data, 2 + 8), le16(data, 2 + 10));
        let feeds_len = message_len.checked_sub(HEADER_LEN).ok_or(bad)?;
        if feeds_len % FEED_INFO_LEN != 0 || feeds_len / FEED_INFO_LEN > MAX_QUOTE_FEEDS || message < offsets_end || message + message_len > suffix {
            return Err(bad);
        }
        for i in 0..count {
            let r = 2 + i * OFFSETS_LEN;
            let (sig, key) = (le16(data, r), le16(data, r + 4));
            if le16(data, r + 8) != message || le16(data, r + 10) != message_len || sig + 64 > suffix || key + 32 > suffix {
                return Err(bad);
            }
        }
        Ok(Self { data, count, message, message_len, suffix })
    }

    pub fn signature_count(&self) -> usize {
        self.count
    }

    /// The slot whose hash the oracles signed.
    pub fn slot(&self) -> u64 {
        let at = self.suffix + self.count;
        u64::from_le_bytes(self.data[at..at + 8].try_into().expect("8 bytes"))
    }

    pub fn signed_slothash(&self) -> [u8; 32] {
        bytes32(self.data, self.message)
    }

    /// In signature order.
    pub fn oracle_idxs(&self) -> &'a [u8] {
        &self.data[self.suffix..self.suffix + self.count]
    }

    /// The ed25519 key of signature `i` (< `signature_count`).
    pub fn signer(&self, i: usize) -> [u8; 32] {
        bytes32(self.data, le16(self.data, 2 + i * OFFSETS_LEN + 4))
    }

    /// `(feed_hash, value × 10⁻¹⁸)` in message order.
    pub fn feeds(&self) -> impl Iterator<Item = ([u8; 32], i128)> + 'a {
        let (data, start, end) = (self.data, self.message + HEADER_LEN, self.message + self.message_len);
        (start..end).step_by(FEED_INFO_LEN).map(move |at| (bytes32(data, at), i128::from_le_bytes(data[at + 32..at + 48].try_into().expect("16 bytes"))))
    }
}

/// §4.4 steps 2–3: the previous instruction is the ed25519 precompile carrying a well-formed quote, and every offsets
/// record's three instruction-index fields name that same instruction (`u16::MAX` or `cur − 1`: the known offsets
/// attack, and the JS SDK 3.10.6 `0xFFFF` encoding).
pub fn check_quote_ix(program_id: &Pubkey, data: &[u8], current_index: u16) -> Result<(), PrintError> {
    if *program_id != ED25519_PROGRAM_ID || current_index == 0 {
        return Err(PrintError::BadAttestation);
    }
    let quote = QuoteView::parse(data)?;
    let own = usize::from(current_index - 1);
    let here = |ix: usize| ix == own || ix == usize::from(u16::MAX);
    for i in 0..quote.signature_count() {
        let r = 2 + i * OFFSETS_LEN;
        if !(here(le16(data, r + 2)) && here(le16(data, r + 6)) && here(le16(data, r + 12))) {
            return Err(PrintError::BadAttestation);
        }
    }
    Ok(())
}

/// The quote's slot is still in SlotHashes with the hash the oracles signed. That blocks replay across clusters, since
/// devnet and mainnet share oracle keys. Missing, newer than the newest entry, or further back than the entries go →
/// `QuoteSlotStale`; a different hash → `BadAttestation`. `slothashes` is the sysvar's account data.
pub fn check_slothash(quote: &QuoteView, slothashes: &[u8]) -> Result<(), PrintError> {
    let stale = PrintError::QuoteSlotStale;
    let entries = usize::try_from(u64::from_le_bytes(slothashes.get(..8).ok_or(stale)?.try_into().expect("8 bytes"))).map_err(|_| stale)?;
    if entries == 0 || slothashes.len() < 8 + entries.checked_mul(SLOT_HASH_LEN).ok_or(stale)? {
        return Err(stale);
    }
    let slot_at = |i: usize| u64::from_le_bytes(slothashes[8 + i * SLOT_HASH_LEN..16 + i * SLOT_HASH_LEN].try_into().expect("8 bytes"));
    let back = slot_at(0).checked_sub(quote.slot()).ok_or(stale)?;
    // Entries are newest first with strictly falling slots, so the target sits at an index ≤ `back`; the crate's walk
    // starts at `back` and must stay inside the entries.
    let start = usize::try_from(back).ok().filter(|b| *b < entries).ok_or(stale)?;
    let found = (0..=start).rev().find(|i| slot_at(*i) == quote.slot()).ok_or(stale)?;
    if bytes32(slothashes, 16 + found * SLOT_HASH_LEN) != quote.signed_slothash() {
        return Err(PrintError::BadAttestation);
    }
    Ok(())
}

/// Every signature's key is the queue's ed25519 signing key at its oracle index, and the index is a real slot (`< 30`,
/// so the crate's `% 30` never aliases one oracle to two indices). `queue` is the pinned queue account's data.
pub fn check_signers(quote: &QuoteView, queue: &[u8]) -> Result<(), PrintError> {
    if queue.len() != QUEUE_ACCOUNT_LEN {
        return Err(PrintError::BadAttestation);
    }
    for (i, idx) in quote.oracle_idxs().iter().enumerate() {
        let idx = usize::from(*idx);
        if idx >= QUEUE_SIGNING_KEY_SLOTS {
            return Err(PrintError::BadAttestation);
        }
        let expected = bytes32(queue, QUEUE_SIGNING_KEYS_OFFSET + idx * 32);
        if expected == [0u8; 32] || expected != quote.signer(i) {
            return Err(PrintError::BadAttestation);
        }
    }
    Ok(())
}

/// §4.4 steps 5–8, in order: no repeated oracle index or signer key (`DuplicateOracle`); at least `min_oracles` (and
/// never fewer than 1) signatures (`TooFewOracles`); exactly one entry for `feed_id` (`SwitchboardFeedMismatch`);
/// `clock_slot − slot ≤ max_slot_age` (`QuoteSlotStale`). Pre-normalized, since `RawPrint.price` is `i64` and
/// $360 × 10¹⁸ is not: `(value floored to 10⁻⁸, expo −8, T, distinct)` (`InvalidPrintValue` when ≤ 0 or too large).
pub fn quote_print(quote: &QuoteView, feed_id: &[u8; 32], max_slot_age: u16, min_oracles: u8, clock_slot: u64, t: i64) -> Result<RawPrint, PrintError> {
    let (idxs, count) = (quote.oracle_idxs(), quote.signature_count());
    for i in 1..count {
        if (0..i).any(|j| idxs[j] == idxs[i] || quote.signer(j) == quote.signer(i)) {
            return Err(PrintError::DuplicateOracle);
        }
    }
    if count < usize::from(min_oracles.max(1)) {
        return Err(PrintError::TooFewOracles);
    }
    let mut matching = quote.feeds().filter(|(hash, _)| hash == feed_id);
    let value = match (matching.next(), matching.next()) {
        (Some((_, value)), None) => value,
        _ => return Err(PrintError::SwitchboardFeedMismatch),
    };
    match clock_slot.checked_sub(quote.slot()) {
        Some(age) if age <= u64::from(max_slot_age) => {}
        _ => return Err(PrintError::QuoteSlotStale),
    }
    let price = normalize(value, SWITCHBOARD_EXPO)?;
    Ok(RawPrint { price, expo: super::normalize::PRINT_EXPO, source_ts: t, signers: count as u8 })
}

/// §4.4 step 4 through the crate, after `check_slothash` and `check_signers` have proven everything it would assert.
/// Any remaining refusal is `BadAttestation`; a stale slot was already named by `quote_print`'s caller.
#[cfg(feature = "switchboard")]
pub fn verify_with_crate<'a>(
    queue: &anchor_lang::prelude::AccountInfo<'a>,
    slothashes: &anchor_lang::prelude::AccountInfo<'a>,
    instructions: &anchor_lang::prelude::AccountInfo<'a>,
    clock_slot: u64,
    max_slot_age: u16,
    data: &[u8],
) -> Result<(), PrintError> {
    let mut verifier = switchboard_on_demand::QuoteVerifier::new();
    verifier.queue(queue).slothash_sysvar(slothashes).ix_sysvar(instructions).clock_slot(clock_slot).max_age(u64::from(max_slot_age));
    verifier.verify(data).map(|_| ()).map_err(|_| PrintError::BadAttestation)
}

// getrandom 0.2 (switchboard-on-demand → libsecp256k1 → rand) has no SBF backend (D-002). Verification never draws
// randomness, so the registered source always fails.
#[cfg(all(feature = "switchboard", target_os = "solana"))]
mod sbf_getrandom {
    fn unsupported(_buf: &mut [u8]) -> Result<(), getrandom::Error> {
        Err(getrandom::Error::UNSUPPORTED)
    }
    getrandom::register_custom_getrandom!(unsupported);
}

#[cfg(test)]
mod tests;
