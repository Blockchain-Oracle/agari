//! A real devnet Surge quote (4 feeds, oracles 0/1/4/6, slot 498,638,533; spike (a), 2026-09-15 06:39Z) against the
//! devnet queue as dumped at slot 498,638,714, plus every refusal built by re-encoding that quote.

use base64::Engine;

use super::*;

const T: i64 = 1_789_452_000;
const SLOT: u64 = 498_638_533;
const TSLAX: [u8; 32] = hex32("86eaad1d9bc2365013c5cb27930c19356c716a5b932b147f0ec57fdfb030c94f");
const QQQX: [u8; 32] = hex32("9aa22f14991485e6431dc2cdb17e130550c2414f83d4f0d20687e43d0aefefa3");

const fn hex32(s: &str) -> [u8; 32] {
    let (b, mut out, mut i) = (s.as_bytes(), [0u8; 32], 0);
    const fn nib(c: u8) -> u8 {
        if c <= b'9' { c - b'0' } else { c - b'a' + 10 }
    }
    while i < 32 {
        out[i] = nib(b[2 * i]) << 4 | nib(b[2 * i + 1]);
        i += 1;
    }
    out
}

fn vector(name: &str) -> String {
    std::fs::read_to_string(format!("{}/../../tests/vectors/prints/{name}", env!("CARGO_MANIFEST_DIR"))).unwrap()
}

fn quote_bytes() -> Vec<u8> {
    let text = vector("switchboard-498638533.hex");
    let t = text.trim();
    (0..t.len()).step_by(2).map(|i| u8::from_str_radix(&t[i..i + 2], 16).unwrap()).collect()
}

fn queue_bytes() -> Vec<u8> {
    base64::engine::general_purpose::STANDARD.decode(vector("switchboard-queue-EYiAm-498638714.b64").trim()).unwrap()
}

/// Re-encodes the quote the SDK way with signatures `picks` (indices into the original), oracle indices `idxs`, every
/// index field `index`, and a message rewritten by `edit`.
fn rebuild(data: &[u8], picks: &[usize], idxs: &[u8], index: u16, edit: impl Fn(&mut Vec<u8>)) -> Vec<u8> {
    let q = QuoteView::parse(data).unwrap();
    let mut message = data[le16(data, 10)..le16(data, 10) + le16(data, 12)].to_vec();
    edit(&mut message);
    let n = picks.len();
    let (sigs, keys) = (2 + 14 * n, 2 + 14 * n + 64 * n);
    let msg = keys + 32 * n;
    let mut out = vec![n as u8, 0];
    for i in 0..n {
        for v in [sigs + 64 * i, usize::from(index), keys + 32 * i, usize::from(index), msg, message.len(), usize::from(index)] {
            out.extend_from_slice(&(v as u16).to_le_bytes());
        }
    }
    for p in picks {
        let at = le16(data, 2 + 14 * p);
        out.extend_from_slice(&data[at..at + 64]);
    }
    for p in picks {
        out.extend_from_slice(&q.signer(*p));
    }
    out.extend_from_slice(&message);
    out.extend_from_slice(idxs);
    out.extend_from_slice(&q.slot().to_le_bytes());
    out.extend_from_slice(&[0, b'S', b'B', b'O', b'D']);
    out
}

/// A SlotHashes account: `entries` slots counting down from `newest`, each hashed as `[slot as u8; 32]` except the
/// quote's slot, which carries `hash`.
fn slothashes(newest: u64, entries: u64, hash: [u8; 32]) -> Vec<u8> {
    let mut out = entries.to_le_bytes().to_vec();
    for slot in (newest + 1 - entries..=newest).rev() {
        out.extend_from_slice(&slot.to_le_bytes());
        out.extend_from_slice(&if slot == SLOT { hash } else { [slot as u8; 32] });
    }
    out.resize(8 + 512 * 40, 0);
    out
}

#[test]
fn the_real_quote_parses_and_prints_tslax() {
    let data = quote_bytes();
    let q = QuoteView::parse(&data).unwrap();
    assert_eq!((q.signature_count(), q.oracle_idxs(), q.slot()), (4, &[0u8, 1, 4, 6][..], SLOT));
    assert_eq!(q.feeds().count(), 4);
    check_quote_ix(&ED25519_PROGRAM_ID, &data, 7).unwrap();
    let queue = queue_bytes();
    let oracles = check_queue_account(&queue).unwrap();
    assert_eq!(oracles, 9, "the devnet queue had 9 live oracles when the fixture was dumped");
    check_signers(&q, &queue, oracles).unwrap();
    check_slothash(&q, &slothashes(SLOT + 5, 30, q.signed_slothash())).unwrap();

    let print = quote_print(&q, &TSLAX, 20, 3, SLOT + 20, T).unwrap();
    // 358.99 × 10¹⁸ → 358.99000000 at expo −8.
    assert_eq!(print, RawPrint { price: 35_899_000_000, expo: -8, source_ts: T, signers: 4 });
    assert_eq!(quote_print(&q, &QQQX, 20, 3, SLOT, T).unwrap().price, 70_933_000_000);
}

#[test]
fn queue_offsets_match_the_crate() {
    #[cfg(feature = "switchboard")]
    {
        assert_eq!(QUEUE_SIGNING_KEYS_OFFSET, 8 + core::mem::offset_of!(switchboard_on_demand::QueueAccountData, ed25519_oracle_signing_keys));
        assert_eq!(QUEUE_ORACLE_KEYS_LEN_OFFSET, 8 + core::mem::offset_of!(switchboard_on_demand::QueueAccountData, oracle_keys_len));
    }
    assert_eq!((QUEUE_SIGNING_KEYS_OFFSET, QUEUE_ORACLE_KEYS_LEN_OFFSET), (4_200, 5_204));
}

#[test]
fn the_queue_account_must_be_a_queue() {
    let mut queue = queue_bytes();
    assert_eq!(check_queue_account(&queue), Ok(9));
    assert_eq!(check_queue_account(&queue[..6_279]), Err(PrintError::SwitchboardQueueMismatch), "wrong size");
    let mut wrong = queue.clone();
    wrong[7] ^= 1;
    assert_eq!(check_queue_account(&wrong), Err(PrintError::SwitchboardQueueMismatch), "another account type");
    queue[QUEUE_ORACLE_KEYS_LEN_OFFSET..QUEUE_ORACLE_KEYS_LEN_OFFSET + 4].copy_from_slice(&31u32.to_le_bytes());
    assert_eq!(check_queue_account(&queue), Err(PrintError::SwitchboardQueueMismatch), "more oracles than key slots");
    queue[QUEUE_ORACLE_KEYS_LEN_OFFSET..QUEUE_ORACLE_KEYS_LEN_OFFSET + 4].copy_from_slice(&0u32.to_le_bytes());
    assert_eq!(check_queue_account(&queue), Err(PrintError::SwitchboardQueueMismatch), "an empty queue signs nothing");
}

#[test]
fn only_an_attestor_records_before_the_public_window() {
    assert_eq!(SWITCHBOARD_PUBLIC_AFTER_SEC, 40);
    assert!(recorder_admitted(true, T + 10, T), "the attestor records from T + min_delay_sec");
    assert!(!recorder_admitted(false, T + 10, T), "a stranger cannot choose the quote");
    assert!(!recorder_admitted(false, T + 39, T));
    assert!(recorder_admitted(false, T + 40, T), "the public fallback keeps a stalled relay from stranding a Window");
    assert!(recorder_admitted(true, i64::MAX, i64::MAX), "no overflow at the edge");
    assert!(!recorder_admitted(false, i64::MAX, i64::MAX));
}

#[test]
fn instruction_shape_and_index_fields() {
    let data = quote_bytes();
    let bad = Err(PrintError::BadAttestation);
    assert_eq!(check_quote_ix(&Pubkey::new_from_array([1; 32]), &data, 1), bad, "not the ed25519 program");
    assert_eq!(check_quote_ix(&ED25519_PROGRAM_ID, &data, 0), bad, "no previous instruction");
    let absolute = rebuild(&data, &[0, 1, 2, 3], &[0, 1, 4, 6], 2, |_| {});
    check_quote_ix(&ED25519_PROGRAM_ID, &absolute, 3).unwrap();
    assert_eq!(check_quote_ix(&ED25519_PROGRAM_ID, &absolute, 4), bad, "offsets pointing at another instruction");
    assert_eq!(check_quote_ix(&ED25519_PROGRAM_ID, &data[..data.len() - 1], 1), bad, "trailer cut");
    assert_eq!(check_quote_ix(&ED25519_PROGRAM_ID, &data[..200], 1), bad, "message past the indices");
    let ragged = rebuild(&data, &[0, 1, 2, 3], &[0, 1, 4, 6], u16::MAX, |m| m.push(0));
    assert_eq!(check_quote_ix(&ED25519_PROGRAM_ID, &ragged, 1), bad, "message not header + 49 B feeds");
    let mut zero = data.clone();
    zero[0] = 0;
    assert_eq!(QuoteView::parse(&zero).unwrap_err(), PrintError::BadAttestation);
}

#[test]
fn signers_must_be_the_queue_keys_at_real_indices() {
    let (data, mut queue) = (quote_bytes(), queue_bytes());
    let q = QuoteView::parse(&data).unwrap();
    let oracles = check_queue_account(&queue).unwrap();
    let swapped = rebuild(&data, &[0, 1, 2, 3], &[1, 0, 4, 6], u16::MAX, |_| {});
    assert_eq!(check_signers(&QuoteView::parse(&swapped).unwrap(), &queue, oracles), Err(PrintError::BadAttestation), "keys at the wrong indices");
    // Index 30 is the crate's `% 30` alias of oracle 0.
    let alias = rebuild(&data, &[0, 0], &[0, 30], u16::MAX, |_| {});
    assert_eq!(check_signers(&QuoteView::parse(&alias).unwrap(), &queue, oracles), Err(PrintError::BadAttestation));
    assert_eq!(check_signers(&q, &queue[..6_279], oracles), Err(PrintError::BadAttestation), "not a queue account");
    // Oracle 6 signed this quote, so a queue that has since swapped down to 4 live oracles must refuse it.
    assert_eq!(check_signers(&q, &queue, 4), Err(PrintError::BadAttestation), "a key slot past oracle_keys_len is stale");
    queue[QUEUE_SIGNING_KEYS_OFFSET + 4 * 32] ^= 1;
    assert_eq!(check_signers(&q, &queue, oracles), Err(PrintError::BadAttestation), "oracle 4 rotated its key");
}

#[test]
fn slothash_must_be_remembered_with_the_signed_hash() {
    let data = quote_bytes();
    let q = QuoteView::parse(&data).unwrap();
    let hash = q.signed_slothash();
    let stale = Err(PrintError::QuoteSlotStale);
    check_slothash(&q, &slothashes(SLOT, 1, hash)).unwrap();
    assert_eq!(check_slothash(&q, &slothashes(SLOT + 3, 30, [9; 32])), Err(PrintError::BadAttestation), "another cluster's hash");
    assert_eq!(check_slothash(&q, &slothashes(SLOT - 1, 30, hash)), stale, "slot newer than the newest entry");
    assert_eq!(check_slothash(&q, &slothashes(SLOT + 30, 30, hash)), stale, "slot aged out of the entries");
    let mut skipped = slothashes(SLOT + 3, 30, hash);
    skipped[8 + 3 * 40] = 0; // the quote's entry now names another slot
    assert_eq!(check_slothash(&q, &skipped), stale, "slot missing (skipped)");
    assert_eq!(check_slothash(&q, &[0u8; 8]), stale, "empty sysvar");
}

#[test]
fn quote_print_refusals_in_order() {
    let data = quote_bytes();
    let dup_idx = rebuild(&data, &[0, 1, 2], &[0, 1, 1], u16::MAX, |_| {});
    let dup_key = rebuild(&data, &[0, 1, 1], &[0, 1, 4], u16::MAX, |_| {});
    let two = rebuild(&data, &[0, 3], &[0, 6], u16::MAX, |_| {});
    let doubled = rebuild(&data, &[0, 1, 2, 3], &[0, 1, 4, 6], u16::MAX, |m| {
        let first = m[32..81].to_vec();
        m.extend_from_slice(&first);
    });
    let print = |d: &[u8], min, clock| quote_print(&QuoteView::parse(d).unwrap(), &TSLAX, 20, min, clock, T);

    assert_eq!(print(&dup_idx, 1, SLOT), Err(PrintError::DuplicateOracle), "a repeated index counts once, so it is refused");
    assert_eq!(print(&dup_key, 1, SLOT), Err(PrintError::DuplicateOracle), "one oracle's key under two indices");
    assert_eq!(print(&dup_idx, 9, SLOT + 99), Err(PrintError::DuplicateOracle), "duplicates are named before count and age");
    assert_eq!(print(&two, 3, SLOT), Err(PrintError::TooFewOracles));
    assert_eq!(print(&two, 2, SLOT).unwrap().signers, 2, "Q-S6-4: a 2-oracle minimum accepts it");
    assert_eq!(print(&two, 0, SLOT).unwrap().signers, 2, "an unset minimum still needs one");
    assert_eq!(print(&data, 5, SLOT), Err(PrintError::TooFewOracles));
    assert_eq!(quote_print(&QuoteView::parse(&data).unwrap(), &[7; 32], 20, 3, SLOT, T), Err(PrintError::SwitchboardFeedMismatch));
    assert_eq!(print(&doubled, 3, SLOT), Err(PrintError::SwitchboardFeedMismatch), "an ambiguous feed");
    assert_eq!(print(&data, 3, SLOT + 21), Err(PrintError::QuoteSlotStale));
    assert_eq!(print(&data, 3, SLOT - 1), Err(PrintError::QuoteSlotStale), "a slot from the future");
    assert_eq!(print(&data, 3, SLOT + 20).unwrap().price, 35_899_000_000, "exactly max_slot_age");

    let zero = rebuild(&data, &[0, 1, 2, 3], &[0, 1, 4, 6], u16::MAX, |m| m[64..80].fill(0));
    assert_eq!(print(&zero, 3, SLOT), Err(PrintError::InvalidPrintValue));
    let dust = rebuild(&data, &[0, 1, 2, 3], &[0, 1, 4, 6], u16::MAX, |m| m[64..80].copy_from_slice(&9_999_999_999i128.to_le_bytes()));
    assert_eq!(print(&dust, 3, SLOT), Err(PrintError::InvalidPrintValue), "floors to 0 at expo −8");
}
