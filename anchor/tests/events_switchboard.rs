//! `public_record_print_switchboard` on LiteSVM (S6 lane 6b; prints.md §4.4, session-lanes.md §2.6). A real devnet
//! Surge quote (TSLAX/NVDAX/SPYX/QQQX, oracles 0/1/4/6 at slot 498,638,533) is verified by the real ed25519
//! precompile against the devnet queue account as dumped by spike (a); SlotHashes and the clock are set around the
//! quote's slot. Every refusal re-encodes those real signatures, so the precompile still passes and the program decides.

use agari_common::print::attested::ED25519_PROGRAM_ID;
use agari_common::seeds::event_authority_address;
use agari_events::instructions::{PolicyVersionArgs, PrintPolicyArgs};
use agari_events_tests::fixtures::{regular_window, series_args, TRIAL_FROM};
use agari_events_tests::harness::key;
use agari_events_tests::prints::{print_authorities, World};
use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::instruction::Instruction;
use anchor_lang::{InstructionData, ToAccountMetas};
use base64::Engine;
use solana_account::Account;
use solana_clock::Clock;
use solana_signer::Signer;
use solana_slot_hashes::SlotHashes;

const BAD_ATTESTATION: u32 = 6208;
const PRINT_TOO_EARLY: u32 = 6204;
const PRINT_TOO_LATE: u32 = 6206;
const SWITCHBOARD_FEED_MISMATCH: u32 = 6214;
const SWITCHBOARD_QUEUE_MISMATCH: u32 = 6215;
const DUPLICATE_ORACLE: u32 = 6216;
const TOO_FEW_ORACLES: u32 = 6217;
const QUOTE_SLOT_STALE: u32 = 6218;

/// Tue 2026-09-15 06:40:00Z, a 5-minute boundary.
const T: i64 = 1_789_452_000;
const SLOT: u64 = 498_638_533;
const QUEUE: Pubkey = anchor_lang::pubkey!("EYiAmGSdsQTuCw413V5BzaruWuCCSDgTPtBGvLkXHbe7");
const QUEUE_OWNER: Pubkey = anchor_lang::pubkey!("Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2");
const SLOT_HASHES: Pubkey = anchor_lang::pubkey!("SysvarS1otHashes111111111111111111111111111");
const INSTRUCTIONS: Pubkey = anchor_lang::pubkey!("Sysvar1nstructions1111111111111111111111111");
/// `price-sources.json` `tokenLane.TSLAx.feedHash` (sha256 of the frozen `agari-surge-TSLAX/USD` feed).
const TSLAX: &str = "86eaad1d9bc2365013c5cb27930c19356c716a5b932b147f0ec57fdfb030c94f";

fn vector(name: &str) -> String {
    std::fs::read_to_string(format!("{}/vectors/prints/{name}", env!("CARGO_MANIFEST_DIR"))).unwrap()
}

fn unhex(text: &str) -> Vec<u8> {
    let t = text.trim();
    (0..t.len()).step_by(2).map(|i| u8::from_str_radix(&t[i..i + 2], 16).unwrap()).collect()
}

fn le16(d: &[u8], at: usize) -> usize {
    usize::from(u16::from_le_bytes([d[at], d[at + 1]]))
}

/// The SDK layout again, keeping real signatures `picks` with oracle indices `idxs` and every index field `index`.
fn rebuild(data: &[u8], picks: &[usize], idxs: &[u8], index: u16) -> Vec<u8> {
    let (msg_at, msg_len) = (le16(data, 10), le16(data, 12));
    let n = picks.len();
    let (sigs, keys, msg) = (2 + 14 * n, 2 + 78 * n, 2 + 110 * n);
    let mut out = vec![n as u8, 0];
    for i in 0..n {
        for v in [sigs + 64 * i, usize::from(index), keys + 32 * i, usize::from(index), msg, msg_len, usize::from(index)] {
            out.extend_from_slice(&(v as u16).to_le_bytes());
        }
    }
    for p in picks {
        let at = le16(data, 2 + 14 * p);
        out.extend_from_slice(&data[at..at + 64]);
    }
    for p in picks {
        let at = le16(data, 2 + 14 * p + 4);
        out.extend_from_slice(&data[at..at + 32]);
    }
    out.extend_from_slice(&data[msg_at..msg_at + msg_len]);
    out.extend_from_slice(idxs);
    out.extend_from_slice(&data[data.len() - 13..]);
    out
}

fn quote_ix(data: Vec<u8>) -> Instruction {
    Instruction { program_id: ED25519_PROGRAM_ID, accounts: vec![], data }
}

fn compute_limit(units: u32) -> Instruction {
    let mut data = vec![2u8];
    data.extend_from_slice(&units.to_le_bytes());
    Instruction { program_id: anchor_lang::pubkey!("ComputeBudget111111111111111111111111111111"), accounts: vec![], data }
}

struct Sb {
    w: World,
    market: Pubkey,
    quote: Vec<u8>,
}

fn switchboard_policy(feed_id: [u8; 32]) -> PolicyVersionArgs {
    let primary = PrintPolicyArgs { source: 3, feed_id, min_delay_sec: 10, max_slot_age: 20, open_admission_sec: 60, close_admission_sec: 60, ..Default::default() };
    PolicyVersionArgs { valid_from_ts: TRIAL_FROM, valid_until_ts: i64::MAX, primary, ..Default::default() }
}

impl Sb {
    /// A TSLAx 5-minute token Series (basis 2) on `feed`, the devnet queue pinned with `min_oracles`, Window 0 at T.
    fn new(feed: &str, min_oracles: u8) -> Self {
        let feed_id: [u8; 32] = unhex(feed).try_into().unwrap();
        let mut w = World::new(series_args(1, 300, 2), switchboard_policy(feed_id), 1);
        let mut authorities = print_authorities(&w.keys);
        (authorities.switchboard_queue, authorities.switchboard_min_oracles) = (QUEUE, min_oracles);
        let admin = key(1);
        let ix = w.h.set_authorities_ix(&admin.pubkey(), authorities);
        w.h.ok(&[ix], &[&admin]);
        let queue = base64::engine::general_purpose::STANDARD.decode(vector("switchboard-queue-EYiAm-498638714.b64").trim()).unwrap();
        let lamports = w.h.svm.minimum_balance_for_rent_exemption(queue.len());
        w.h.svm.set_account(QUEUE, Account { lamports, data: queue, owner: QUEUE_OWNER, executable: false, rent_epoch: 0 }).unwrap();
        let market = w.open(regular_window(0, T, 300, 0));
        Self { w, market, quote: unhex(&vector("switchboard-498638533.hex")) }
    }

    /// Clock at `ts` and `slot`; SlotHashes holds the 30 slots before it, with the quote's signed hash at its slot
    /// (or `hash` instead, when given).
    fn at(&mut self, ts: i64, slot: u64, hash: Option<[u8; 32]>) {
        let mut clock: Clock = self.w.h.svm.get_sysvar();
        (clock.unix_timestamp, clock.slot) = (ts, slot);
        self.w.h.svm.set_sysvar(&clock);
        let signed: [u8; 32] = self.quote[le16(&self.quote, 10)..le16(&self.quote, 10) + 32].try_into().unwrap();
        let entries: Vec<(u64, solana_hash::Hash)> = (1..=30u64)
            .map(|back| {
                let s = slot - back;
                (s, solana_hash::Hash::new_from_array(if s == SLOT { hash.unwrap_or(signed) } else { [s as u8; 32] }))
            })
            .collect();
        self.w.h.svm.set_sysvar(&SlotHashes::new(&entries));
    }

    fn record_ix(&self, which: u8, queue: Pubkey) -> Instruction {
        let accounts = agari_events::accounts::PublicRecordPrintSwitchboard {
            series: self.w.series,
            market: self.market,
            config: agari_events_tests::ix::config(),
            queue,
            slothashes: SLOT_HASHES,
            instructions: INSTRUCTIONS,
            event_authority: event_authority_address(&agari_events::ID).0,
            program: agari_events::ID,
        };
        Instruction { program_id: agari_events::ID, accounts: accounts.to_account_metas(None), data: agari_events::instruction::PublicRecordPrintSwitchboard { which }.data() }
    }

    fn print(&mut self, quote: Vec<u8>) -> Result<agari_events_tests::Sent, u32> {
        let ixs = [quote_ix(quote), self.record_ix(0, QUEUE)];
        self.w.send(&ixs)
    }
}

#[test]
fn a_real_devnet_quote_prints_tslax_and_fits_a_legacy_transaction() {
    let mut sb = Sb::new(TSLAX, 3);
    sb.at(T + 12, SLOT + 20, None);
    // Three of the four real signatures (what a min-3 relay sends), then all four with a compute limit first.
    let three = rebuild(&sb.quote, &[0, 1, 2], &[0, 1, 4], u16::MAX);
    let sent = sb.print(three).unwrap();
    println!("Switchboard print, 3 oracles, 4 feeds: {} CU, {} transaction bytes (limit 1,232)", sent.compute_units, sent.tx_bytes);
    let open = sb.w.h.market_state(&sb.market).open;
    assert_eq!((open.price, open.expo, open.source, open.signers, open.source_ts), (35_899_000_000, -8, 3, 3, T), "358.99 observed after T");
    assert!(sent.tx_bytes <= 1_232);

    let mut four = Sb::new(TSLAX, 3);
    four.at(T + 60, SLOT + 1, None);
    let ixs = [compute_limit(60_000), quote_ix(four.quote.clone()), four.record_ix(0, QUEUE)];
    let sent = four.w.send(&ixs).unwrap();
    println!("Switchboard print, 4 oracles + SetComputeUnitLimit: {} CU, {} transaction bytes", sent.compute_units, sent.tx_bytes);
    assert!(sent.tx_bytes <= 1_232 && sent.compute_units <= 60_000);
    assert_eq!(four.w.h.market_state(&four.market).open.signers, 4);
    assert_eq!(four.print(four.quote.clone()).unwrap_err(), 6201, "the first valid print wins");
}

#[test]
fn refused_outside_the_clock_bounded_admission() {
    let mut sb = Sb::new(TSLAX, 3);
    sb.at(T + 9, SLOT + 5, None);
    assert_eq!(sb.print(sb.quote.clone()).unwrap_err(), PRINT_TOO_EARLY, "before T + min_delay_sec");
    sb.at(T + 61, SLOT + 5, None);
    assert_eq!(sb.print(sb.quote.clone()).unwrap_err(), PRINT_TOO_LATE, "after T + admission_sec");
}

#[test]
fn refused_for_a_stale_or_foreign_slot() {
    let mut sb = Sb::new(TSLAX, 3);
    sb.at(T + 30, SLOT + 21, None);
    assert_eq!(sb.print(sb.quote.clone()).unwrap_err(), QUOTE_SLOT_STALE, "21 slots > max_slot_age 20");
    sb.at(T + 30, SLOT + 5, Some([9; 32]));
    assert_eq!(sb.print(sb.quote.clone()).unwrap_err(), BAD_ATTESTATION, "signed over another cluster's slot hash");
    sb.at(T + 30, SLOT, None);
    assert_eq!(sb.print(sb.quote.clone()).unwrap_err(), QUOTE_SLOT_STALE, "the slot is not in SlotHashes yet");
}

#[test]
fn refused_for_the_wrong_queue_or_an_unset_one() {
    let mut sb = Sb::new(TSLAX, 3);
    sb.at(T + 30, SLOT + 5, None);
    let copy = Pubkey::new_from_array([0x51; 32]);
    let data = sb.w.h.account_data(&QUEUE);
    let lamports = sb.w.h.svm.minimum_balance_for_rent_exemption(data.len());
    sb.w.h.svm.set_account(copy, Account { lamports, data, owner: QUEUE_OWNER, executable: false, rent_epoch: 0 }).unwrap();
    let ixs = [quote_ix(sb.quote.clone()), sb.record_ix(0, copy)];
    assert_eq!(sb.w.send(&ixs).unwrap_err(), SWITCHBOARD_QUEUE_MISMATCH, "same bytes, unpinned address");

    let admin = key(1);
    let ix = sb.w.h.set_authorities_ix(&admin.pubkey(), print_authorities(&sb.w.keys));
    sb.w.h.ok(&[ix], &[&admin]);
    let ixs = [quote_ix(sb.quote.clone()), sb.record_ix(0, Pubkey::default())];
    assert_eq!(sb.w.send(&ixs).unwrap_err(), SWITCHBOARD_QUEUE_MISMATCH, "the zero placeholder is never a queue");
}

#[test]
fn refused_for_duplicate_or_too_few_oracles() {
    let mut sb = Sb::new(TSLAX, 3);
    sb.at(T + 30, SLOT + 5, None);
    let quote = sb.quote.clone();
    assert_eq!(sb.print(rebuild(&quote, &[0, 1, 1], &[0, 1, 1], u16::MAX)).unwrap_err(), DUPLICATE_ORACLE, "oracle 1 twice");
    assert_eq!(sb.print(rebuild(&quote, &[0, 0, 1], &[0, 30, 1], u16::MAX)).unwrap_err(), BAD_ATTESTATION, "index 30 aliases oracle 0");
    assert_eq!(sb.print(rebuild(&quote, &[1, 2], &[0, 4], u16::MAX)).unwrap_err(), BAD_ATTESTATION, "a key under another oracle's index");
    assert_eq!(sb.print(rebuild(&quote, &[0, 3], &[0, 6], u16::MAX)).unwrap_err(), TOO_FEW_ORACLES, "2 < min 3");

    let mut two = Sb::new(TSLAX, 2);
    two.at(T + 30, SLOT + 5, None);
    assert_eq!(two.print(rebuild(&quote, &[0, 3], &[0, 6], u16::MAX)).unwrap().compute_units > 0, true, "Q-S6-4: min 2 accepts two");
    assert_eq!(two.w.h.market_state(&two.market).open.signers, 2);
}

#[test]
fn refused_for_the_wrong_feed_or_a_foreign_index_field() {
    let mut other = Sb::new("cafe000000000000000000000000000000000000000000000000000000000000", 3);
    other.at(T + 30, SLOT + 5, None);
    assert_eq!(other.print(other.quote.clone()).unwrap_err(), SWITCHBOARD_FEED_MISMATCH, "a quote without this Series' feed");

    let mut sb = Sb::new(TSLAX, 3);
    sb.at(T + 30, SLOT + 5, None);
    // Instruction 1 verifies instruction 0's bytes (index fields = 0), so the precompile passes but it is not "this
    // instruction" for the record at index 2.
    let pointing = rebuild(&sb.quote, &[0, 1, 2, 3], &[0, 1, 4, 6], 0);
    let ixs = [quote_ix(sb.quote.clone()), quote_ix(pointing), sb.record_ix(0, QUEUE)];
    assert_eq!(sb.w.send(&ixs).unwrap_err(), BAD_ATTESTATION, "offsets naming another instruction");
    let ixs = [quote_ix(sb.quote.clone()), compute_limit(100_000), sb.record_ix(0, QUEUE)];
    assert_eq!(sb.w.send(&ixs).unwrap_err(), BAD_ATTESTATION, "the quote is not immediately before the record");
}
