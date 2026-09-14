//! Print instructions on LiteSVM (S2 lane P): the real Pyth trial update, synthetic RedStone packages signed by
//! five test keys, real ed25519 attestations, and copy-open. Codes are the engine's (events-accounts.md §4).

use agari_events::state::PRINT_FLAG_COPIED_FROM_PREV;
use agari_events_tests::fixtures::{redstone, regular_window, series_args, TRIAL_FROM};
use agari_events_tests::harness::key;
use agari_events_tests::prints::*;
use anchor_lang::solana_program::instruction::Instruction;

const OWNED_BY_WRONG_PROGRAM: u32 = 3007;
const WRONG_PRINT_SOURCE: u32 = 6200;
const PRINT_ALREADY_RECORDED: u32 = 6201;
const PRINT_TOO_EARLY: u32 = 6204;
const PRINT_NOT_UNIQUE: u32 = 6205;
const PRINT_TOO_LATE: u32 = 6206;
const BAD_ATTESTATION: u32 = 6208;
const UNKNOWN_ATTESTOR: u32 = 6209;
const INSUFFICIENT_REDSTONE_SIGNERS: u32 = 6213;
const PRINTS_MISSING: u32 = 6222;
const PRINT_NOT_ADJACENT: u32 = 6228;

const T: i64 = T_PYTH;

/// `SetComputeUnitLimit(units)`: RedStone's five recoveries exceed the 200k default.
fn compute_limit(units: u32) -> Instruction {
    let mut data = vec![2u8];
    data.extend_from_slice(&units.to_le_bytes());
    Instruction { program_id: anchor_lang::pubkey!("ComputeBudget111111111111111111111111111111"), accounts: vec![], data }
}

#[test]
fn pyth_records_the_real_trial_update_at_exact_t() {
    let mut w = World::regular(version(pyth_policy(), None), 1);
    let m0 = w.open(regular_window(0, T, 300, 0));
    let fixture = pyth_fixture();
    let real = w.put_price_update(pyth_solana_receiver_sdk::ID, &fixture);
    w.h.warp_to(T + 3);

    let pro = w.put_price_update(PRO_RECEIVER, &fixture);
    assert_eq!(w.send(&[w.pyth_ix(m0, pro, 0)]).unwrap_err(), OWNED_BY_WRONG_PROGRAM, "only the default receiver's accounts (D-021)");

    let mut early = fixture.clone();
    (early.price_message.publish_time, early.price_message.prev_publish_time) = (T - 1, T - 2);
    let early = w.put_price_update(pyth_solana_receiver_sdk::ID, &early);
    assert_eq!(w.send(&[w.pyth_ix(m0, early, 0)]).unwrap_err(), PRINT_NOT_UNIQUE, "an update from T − 1 is not the print at T");
    let mut late = fixture.clone();
    (late.price_message.publish_time, late.price_message.prev_publish_time) = (T + 1, T);
    let late = w.put_price_update(pyth_solana_receiver_sdk::ID, &late);
    assert_eq!(w.send(&[w.pyth_ix(m0, late, 0)]).unwrap_err(), PRINT_NOT_UNIQUE, "the T + 1 update follows one at T");
    assert_eq!(w.send(&[w.pyth_ix(m0, real, 2)]).unwrap_err(), WRONG_PRINT_SOURCE, "a check slot on a version without a check");

    w.send(&[w.pyth_ix(m0, real, 0)]).unwrap();
    let open = w.h.market_state(&m0).open;
    assert_eq!((open.price, open.expo, open.source, open.signers, open.source_ts), (36_547_600_000, -8, 1, 0, T));
    assert_eq!(w.send(&[w.pyth_ix(m0, real, 0)]).unwrap_err(), PRINT_ALREADY_RECORDED, "the first valid print wins");
}

#[test]
fn redstone_requires_every_signer_inside_strict_then_three() {
    let mut w = World::regular(version(redstone(b"NVDA", 900, 300), None), 1);
    let m0 = w.open(regular_window(0, T, 300, 0));
    let nvda = feed(b"NVDA");
    let keys = &w.keys.redstone;
    let four = redstone_payload(&keys[..4], nvda, 18_512_000_000, T as u64 * 1_000);
    let five = redstone_payload(keys, nvda, 18_512_000_000, T as u64 * 1_000);

    w.h.warp_to(T + 15);
    assert_eq!(w.send(&[compute_limit(400_000), w.redstone_ix(m0, 0, four)]).unwrap_err(), INSUFFICIENT_REDSTONE_SIGNERS, "4 of 5 inside strict");
    // No compute-budget instruction: the default 200k limit and a legacy transaction must both suffice.
    let sent = w.send(&[w.redstone_ix(m0, 0, five)]).unwrap();
    println!("RedStone 5-package print: {} CU, {} transaction bytes (limit 1,232)", sent.compute_units, sent.tx_bytes);
    assert!(sent.tx_bytes <= 1_232 && sent.compute_units <= 200_000, "fits a legacy transaction and the default budget");
    let open = w.h.market_state(&m0).open;
    assert_eq!((open.price, open.source, open.signers, open.source_ts), (18_512_000_000, 2, 5, T));

    // Close boundary T + 300, strict 300 s: three signers are refused at +299 and accepted from +300.
    let close_ts = (T + 300) as u64 * 1_000;
    let three = |w: &World| redstone_payload(&w.keys.redstone[1..4], nvda, 18_530_000_000, close_ts);
    w.h.warp_to(T + 300 + 299);
    let early = three(&w);
    assert_eq!(w.send(&[compute_limit(400_000), w.redstone_ix(m0, 1, early)]).unwrap_err(), INSUFFICIENT_REDSTONE_SIGNERS);
    w.h.warp_to(T + 300 + 300);
    let ok = three(&w);
    let sent3 = w.send(&[compute_limit(400_000), w.redstone_ix(m0, 1, ok)]).unwrap();
    println!("RedStone 3-package print: {} CU, {} transaction bytes", sent3.compute_units, sent3.tx_bytes);
    assert_eq!(w.h.market_state(&m0).close.signers, 3);
}

#[test]
fn attested_prints_need_the_attestor_signature_in_the_previous_instruction() {
    let mut w = World::regular(version(attested_policy(), None), 1);
    let m0 = w.open(regular_window(0, T, 300, 0));
    let price = 36_547_600_000;

    w.h.warp_to(T + 59);
    let early = w.attested_pair(&w.keys.attestor, m0, 0, price, T, T + 59);
    assert_eq!(w.send(&early).unwrap_err(), PRINT_TOO_EARLY, "the correction cutoff min_delay_sec = 60");
    w.h.warp_to(T + 61);

    let stranger = key(10);
    assert_eq!(w.send(&w.attested_pair(&stranger, m0, 0, price, T, T + 60)).unwrap_err(), UNKNOWN_ATTESTOR);
    assert_eq!(w.send(&[w.attested_ix(m0, 0, price, -8, T, T + 60)]).unwrap_err(), BAD_ATTESTATION, "no ed25519 instruction before it");

    let [sig, _] = w.attested_pair(&w.keys.attestor, m0, 0, price, T, T + 60);
    let other_price = w.attested_ix(m0, 0, price + 1, -8, T, T + 60);
    assert_eq!(w.send(&[sig.clone(), other_price]).unwrap_err(), BAD_ATTESTATION, "the signature covers another price");

    // Offsets attack: instruction 1 verifies bytes that live in instruction 0; the print must refuse to trust it.
    let mut pointer = sig.clone();
    pointer.data.truncate(16);
    let attack = w.attested_ix(m0, 0, price, -8, T, T + 60);
    assert_eq!(w.send(&[sig, pointer, attack]).unwrap_err(), BAD_ATTESTATION, "offsets must point into cur − 1 itself");

    let sent = w.send(&w.attested_pair(&w.keys.attestor, m0, 0, price, T, T + 60)).unwrap();
    println!("attested print: {} CU, {} transaction bytes", sent.compute_units, sent.tx_bytes);
    let open = w.h.market_state(&m0).open;
    assert_eq!((open.price, open.source, open.signers, open.source_ts), (price, 4, 1, T));
}

#[test]
fn copy_open_takes_the_adjacent_close_on_the_same_version_until_the_open_deadline() {
    let mut w = World::regular(version(redstone(b"NVDA", 900, 300), None), 4);
    let m0 = w.open(regular_window(0, T, 300, 0));
    let m1 = w.open(regular_window(1, T + 300, 300, 0));
    let m2 = w.open(regular_window(2, T + 900, 300, 0));
    let nvda = feed(b"NVDA");

    w.h.warp_to(T + 315);
    assert_eq!(w.send(&[w.copy_open_ix(m1, m0)]).unwrap_err(), PRINTS_MISSING, "the previous close isn't recorded yet");
    assert_eq!(w.send(&[w.copy_open_ix(m1, m1)]).unwrap_err(), PRINT_NOT_ADJACENT, "a Window is never its own predecessor");
    let close = redstone_payload(&w.keys.redstone, nvda, 18_530_000_000, (T + 300) as u64 * 1_000);
    w.send(&[compute_limit(400_000), w.redstone_ix(m0, 1, close)]).unwrap();

    assert_eq!(w.send(&[w.copy_open_ix(m2, m0)]).unwrap_err(), PRINT_NOT_ADJACENT, "a time gap (Friday close → Monday open)");
    w.send(&[w.copy_open_ix(m1, m0)]).unwrap();
    let (m0s, m1s) = (w.h.market_state(&m0), w.h.market_state(&m1));
    assert_eq!((m1s.open.price, m1s.open.source_ts, m1s.open.signers), (m0s.close.price, m0s.close.source_ts, m0s.close.signers));
    assert_eq!(m1s.open.flags & PRINT_FLAG_COPIED_FROM_PREV, PRINT_FLAG_COPIED_FROM_PREV);
    assert_eq!(w.send(&[w.copy_open_ix(m1, m0)]).unwrap_err(), PRINT_ALREADY_RECORDED);

    // PD-6: past Window 2's open deadline the copy is refused like any late print.
    let m3 = w.open(regular_window(3, T + 1_200, 300, 0));
    let close2 = redstone_payload(&w.keys.redstone, nvda, 18_540_000_000, (T + 1_200) as u64 * 1_000);
    w.h.warp_to(T + 1_200 + 15);
    w.send(&[compute_limit(400_000), w.redstone_ix(m2, 1, close2)]).unwrap();
    w.h.warp_to(T + 1_200 + 901);
    assert_eq!(w.send(&[w.copy_open_ix(m3, m2)]).unwrap_err(), PRINT_TOO_LATE);
}

#[test]
fn copy_open_never_crosses_a_policy_version_switch() {
    // v0 covers Window 0 only; v1 starts at its close, exactly like the D-003 phase switch.
    let nvda = redstone(b"NVDA", 900, 300);
    let mut v0 = version(nvda, None);
    (v0.valid_from_ts, v0.valid_until_ts) = (TRIAL_FROM, T + 300);
    let mut v1 = version(nvda, None);
    v1.valid_from_ts = T + 300;
    let mut w = World::new(series_args(2, 300, 0), v0, 2);
    w.h.add_policy(&w.series, 1, v1).unwrap();
    let m0 = w.open(regular_window(0, T, 300, 0));
    let m1 = w.open(regular_window(1, T + 300, 300, 1));

    w.h.warp_to(T + 315);
    let close = redstone_payload(&w.keys.redstone, feed(b"NVDA"), 18_530_000_000, (T + 300) as u64 * 1_000);
    w.send(&[compute_limit(400_000), w.redstone_ix(m0, 1, close)]).unwrap();
    assert_eq!(w.send(&[w.copy_open_ix(m1, m0)]).unwrap_err(), PRINT_NOT_ADJACENT, "same instant, different version");
    assert!(w.h.market_state(&m1).open.source == 0);
}

#[test]
fn copy_open_carries_the_check_close_only_inside_the_check_window() {
    // Attested primary (60 s delay) checked by RedStone (60 s strict inside a 120 s window), like drive Series 900.
    let tsla = feed(b"TSLA");
    let mut w = World::regular(version(attested_policy(), Some(redstone(b"TSLA", 120, 60))), 4);
    let m0 = w.open(regular_window(0, T, 300, 0));
    let m1 = w.open(regular_window(1, T + 300, 300, 0));
    let m2 = w.open(regular_window(2, T + 600, 300, 0));

    // Window 0 closes at T + 300 with both prints; Window 1 copies both at T + 360, inside its check window (T + 420).
    w.h.warp_to(T + 330);
    let check = redstone_payload(&w.keys.redstone, tsla, 36_550_000_000, (T + 300) as u64 * 1_000);
    w.send(&[compute_limit(400_000), w.redstone_ix(m0, 3, check)]).unwrap();
    w.h.warp_to(T + 360);
    let close = w.attested_pair(&w.keys.attestor, m0, 1, 36_549_000_000, T + 300, T + 360);
    w.send(&close).unwrap();
    w.send(&[w.copy_open_ix(m1, m0)]).unwrap();
    let (m0s, m1s) = (w.h.market_state(&m0), w.h.market_state(&m1));
    assert_eq!((m1s.open.price, m1s.open.source), (m0s.close.price, m0s.close.source));
    assert_eq!((m1s.check_open.price, m1s.check_open.signers), (m0s.check_close.price, 5));
    assert_eq!(m1s.check_open.flags & PRINT_FLAG_COPIED_FROM_PREV, PRINT_FLAG_COPIED_FROM_PREV);

    // Window 1 closes at T + 600; Window 2 copies at T + 721, past its check window (T + 720): the open only.
    w.h.warp_to(T + 630);
    let check = redstone_payload(&w.keys.redstone, tsla, 36_560_000_000, (T + 600) as u64 * 1_000);
    w.send(&[compute_limit(400_000), w.redstone_ix(m1, 3, check)]).unwrap();
    w.h.warp_to(T + 660);
    let close = w.attested_pair(&w.keys.attestor, m1, 1, 36_559_000_000, T + 600, T + 660);
    w.send(&close).unwrap();
    w.h.warp_to(T + 721);
    w.send(&[w.copy_open_ix(m2, m1)]).unwrap();
    let m2s = w.h.market_state(&m2);
    assert_eq!(m2s.open.price, 36_559_000_000);
    assert_eq!(m2s.check_open.source, 0, "a check copied after its own window would outlive the rule it enforces");
}
