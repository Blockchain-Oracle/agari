//! `public_record_print_switchboard` on LiteSVM (S6 lane 6b; prints.md §4.4, session-lanes.md §2.6). A real devnet
//! Surge quote (TSLAX/NVDAX/SPYX/QQQX, oracles 0/1/4/6 at slot 498,638,533) is verified by the real ed25519
//! precompile against the devnet queue account as dumped by spike (a); SlotHashes and the clock are set around the
//! quote's slot. Every refusal re-encodes those real signatures, so the precompile still passes and the program decides.
//! The D-088 security review adds the recorder window (attestor until `T + 40`, public after) and the rule that an
//! Open whose previous Close exists belongs to `public_copy_open_from_prev`.

use agari_common::print::attested::ED25519_PROGRAM_ID;
use agari_common::seeds::event_authority_address;
use agari_events::instructions::{PolicyVersionArgs, PrintPolicyArgs};
use agari_events_tests::fixtures::{regular_window, series_args, TRIAL_FROM};
use agari_events_tests::harness::{key, SOL};
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
const UNKNOWN_ATTESTOR: u32 = 6209;
const PRINT_NOT_ADJACENT: u32 = 6228;

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

fn queue_bytes() -> Vec<u8> {
    base64::engine::general_purpose::STANDARD.decode(vector("switchboard-queue-EYiAm-498638714.b64").trim()).unwrap()
}

fn put_queue(w: &mut World, address: Pubkey, owner: Pubkey, data: Vec<u8>) {
    let lamports = w.h.svm.minimum_balance_for_rent_exemption(data.len());
    w.h.svm.set_account(address, Account { lamports, data, owner, executable: false, rent_epoch: 0 }).unwrap();
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
        put_queue(&mut w, QUEUE, QUEUE_OWNER, queue_bytes());
        let mut authorities = print_authorities(&w.keys);
        (authorities.switchboard_queue, authorities.switchboard_min_oracles) = (QUEUE, min_oracles);
        let admin = key(1);
        // The handler checks the queue account whenever the pin is set (D-088 low finding).
        let ix = w.h.set_authorities_queue_ix(&admin.pubkey(), authorities, Some(QUEUE));
        w.h.ok(&[ix], &[&admin]);
        w.h.svm.airdrop(&w.keys.attestor.pubkey(), 10 * SOL).expect("airdrop the attestor");
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
        self.record_ix_as(which, queue, self.w.keys.attestor.pubkey(), None)
    }

    /// The print instruction as `recorder`, optionally naming the previous Window (an Open past index 0 needs it).
    fn record_ix_as(&self, which: u8, queue: Pubkey, recorder: Pubkey, prev_market: Option<Pubkey>) -> Instruction {
        let accounts = agari_events::accounts::PublicRecordPrintSwitchboard {
            recorder,
            series: self.w.series,
            market: self.market,
            config: agari_events_tests::ix::config(),
            queue,
            prev_market,
            slothashes: SLOT_HASHES,
            instructions: INSTRUCTIONS,
            event_authority: event_authority_address(&agari_events::ID).0,
            program: agari_events::ID,
        };
        Instruction { program_id: agari_events::ID, accounts: accounts.to_account_metas(None), data: agari_events::instruction::PublicRecordPrintSwitchboard { which }.data() }
    }

    /// A print by the attestor, the way the relay sends it.
    fn print(&mut self, quote: Vec<u8>) -> Result<agari_events_tests::Sent, u32> {
        let ixs = [quote_ix(quote), self.record_ix(0, QUEUE)];
        let attestor = self.w.keys.attestor.insecure_clone();
        self.w.h.send(&ixs, &[&attestor])
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
    let attestor = four.w.keys.attestor.insecure_clone();
    let sent = four.w.h.send(&ixs, &[&attestor]).unwrap();
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
    let attestor = sb.w.keys.attestor.insecure_clone();
    let copy = Pubkey::new_from_array([0x51; 32]);
    put_queue(&mut sb.w, copy, QUEUE_OWNER, queue_bytes());
    let ixs = [quote_ix(sb.quote.clone()), sb.record_ix(0, copy)];
    assert_eq!(sb.w.h.send(&ixs, &[&attestor]).unwrap_err(), SWITCHBOARD_QUEUE_MISMATCH, "same bytes, unpinned address");

    // The pinned address with a foreign owner, or with another account type's bytes, is not the queue either.
    put_queue(&mut sb.w, QUEUE, Pubkey::new_from_array([0x99; 32]), queue_bytes());
    let ixs = [quote_ix(sb.quote.clone()), sb.record_ix(0, QUEUE)];
    assert_eq!(sb.w.h.send(&ixs, &[&attestor]).unwrap_err(), SWITCHBOARD_QUEUE_MISMATCH, "another program's account at the pinned address");
    let mut forged = queue_bytes();
    forged[7] ^= 1;
    put_queue(&mut sb.w, QUEUE, QUEUE_OWNER, forged);
    let ixs = [quote_ix(sb.quote.clone()), sb.record_ix(0, QUEUE)];
    assert_eq!(sb.w.h.send(&ixs, &[&attestor]).unwrap_err(), SWITCHBOARD_QUEUE_MISMATCH, "not a queue discriminator");

    let admin = key(1);
    let ix = sb.w.h.set_authorities_ix(&admin.pubkey(), print_authorities(&sb.w.keys));
    sb.w.h.ok(&[ix], &[&admin]);
    let ixs = [quote_ix(sb.quote.clone()), sb.record_ix(0, Pubkey::default())];
    assert_eq!(sb.w.h.send(&ixs, &[&attestor]).unwrap_err(), SWITCHBOARD_QUEUE_MISMATCH, "the zero placeholder is never a queue");
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
    let attestor = sb.w.keys.attestor.insecure_clone();
    let pointing = rebuild(&sb.quote, &[0, 1, 2, 3], &[0, 1, 4, 6], 0);
    let ixs = [quote_ix(sb.quote.clone()), quote_ix(pointing), sb.record_ix(0, QUEUE)];
    assert_eq!(sb.w.h.send(&ixs, &[&attestor]).unwrap_err(), BAD_ATTESTATION, "offsets naming another instruction");
    let ixs = [quote_ix(sb.quote.clone()), compute_limit(100_000), sb.record_ix(0, QUEUE)];
    assert_eq!(sb.w.h.send(&ixs, &[&attestor]).unwrap_err(), BAD_ATTESTATION, "the quote is not immediately before the record");
}

#[test]
fn only_an_attestor_may_choose_the_quote_until_the_public_window() {
    let mut sb = Sb::new(TSLAX, 3);
    sb.at(T + 10, SLOT + 5, None);
    let stranger = key(3);
    let ixs = [quote_ix(sb.quote.clone()), sb.record_ix_as(0, QUEUE, stranger.pubkey(), None)];
    assert_eq!(sb.w.h.send(&ixs, &[&stranger]).unwrap_err(), UNKNOWN_ATTESTOR, "a trader may not pick the quote at T + 10");
    // The attestor records at once; the relay's own path is unchanged.
    sb.print(sb.quote.clone()).unwrap();
    assert_eq!(sb.w.h.market_state(&sb.market).open.signers, 4);

    // A second Window, left to the public fallback: refused at T + 39, taken at T + 40.
    let mut late = Sb::new(TSLAX, 3);
    late.at(T + 39, SLOT + 5, None);
    let ixs = [quote_ix(late.quote.clone()), late.record_ix_as(0, QUEUE, stranger.pubkey(), None)];
    assert_eq!(late.w.h.send(&ixs, &[&stranger]).unwrap_err(), UNKNOWN_ATTESTOR);
    late.at(T + 40, SLOT + 5, None);
    let ixs = [quote_ix(late.quote.clone()), late.record_ix_as(0, QUEUE, stranger.pubkey(), None)];
    late.w.h.send(&ixs, &[&stranger]).expect("the public fallback keeps a stalled relay from stranding a Window");
    assert_eq!(late.w.h.market_state(&late.market).open.source, 3);
}

#[test]
fn an_open_whose_previous_close_exists_must_be_copied() {
    let mut sb = Sb::new(TSLAX, 3);
    // Window 0 takes its close at its own boundary T + 300, which is Window 1's opening boundary.
    let (t1, slot1) = (T + 300, SLOT + 15);
    sb.w.h.warp_to(t1 - 60);
    // Window 0 still holds the only Book, so the next Window needs its own.
    let book = sb.w.h.add_book(&sb.w.series, 256);
    sb.w.h.open_window(&sb.w.series, &book, regular_window(1, t1, 300, 0)).expect("second window");
    let market1 = agari_events_tests::ix::window_accounts(&sb.w.series, 1).market;
    let prev = sb.market;

    sb.at(t1 + 12, slot1, None);
    // The close of Window 0 lands first, from the same quote the relay holds.
    sb.market = prev;
    let close = [quote_ix(sb.quote.clone()), sb.record_ix(1, QUEUE)];
    let attestor = sb.w.keys.attestor.insecure_clone();
    sb.w.h.send(&close, &[&attestor]).expect("close of window 0");

    // Window 1's open is now the previous Close's print: a direct print is refused, even for the attestor.
    sb.market = market1;
    let direct = [quote_ix(sb.quote.clone()), sb.record_ix_as(0, QUEUE, attestor.pubkey(), Some(prev))];
    assert_eq!(sb.w.h.send(&direct, &[&attestor]).unwrap_err(), PRINT_NOT_ADJACENT, "that slot belongs to public_copy_open_from_prev");
    let without = [quote_ix(sb.quote.clone()), sb.record_ix_as(0, QUEUE, attestor.pubkey(), None)];
    assert_eq!(sb.w.h.send(&without, &[&attestor]).unwrap_err(), PRINT_NOT_ADJACENT, "the previous Window may not be omitted");

    // The copy fills it, and both Windows carry the same print.
    let copy = sb.w.copy_open_ix(market1, prev);
    sb.w.h.send(&[copy], &[&attestor]).expect("copy open");
    let (close_print, open_print) = (sb.w.h.market_state(&prev).close, sb.w.h.market_state(&market1).open);
    assert_eq!((open_print.price, open_print.source_ts), (close_print.price, close_print.source_ts));
}
