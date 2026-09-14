//! Settle, void and the PD-6 race at every source's exact deadline (S2 lane P). At `deadline` only the print is
//! admissible; at `deadline + 1` only the void (or, for check prints, single-source settlement).

use agari_events::constants::GAP_CADENCE_SEC;
use agari_events::state::MARKET_FLAG_SINGLE_SOURCE;
use agari_events_tests::fixtures::{gap_version, gap_window_0925, redstone, regular_window, series_args, CLOSE_0925, GAP_LOCK_0927};
use agari_events_tests::harness::key;
use agari_events_tests::prints::*;
use anchor_lang::prelude::Pubkey;
use anchor_lang::solana_program::instruction::Instruction;
use solana_signer::Signer;

const PRINT_TOO_LATE: u32 = 6206;
const CROSS_CHECK_PENDING: u32 = 6219;
const SETTLEMENT_WINDOW_OPEN: u32 = 6223;

const T: i64 = T_PYTH;
const E8: i64 = 100_000_000;

fn compute_limit() -> Instruction {
    let mut data = vec![2u8];
    data.extend_from_slice(&400_000u32.to_le_bytes());
    Instruction { program_id: anchor_lang::pubkey!("ComputeBudget111111111111111111111111111111"), accounts: vec![], data }
}

/// An attested primary print for boundary `t`, sent at `now` (fetched at `now`).
fn attest(w: &mut World, m: Pubkey, which: u8, price: i64, t: i64, now: i64) {
    w.h.warp_to(now);
    let pair = w.attested_pair(&w.keys.attestor, m, which, price, t, now);
    w.send(&pair).expect("attested print");
}

/// A RedStone print from the first `n` test signers for boundary `t`, sent at `now`.
fn redstone_print(w: &mut World, m: Pubkey, which: u8, tag: &[u8], price: i64, t: i64, now: i64, n: usize) -> Result<agari_events_tests::Sent, u32> {
    w.h.warp_to(now);
    let payload = redstone_payload(&w.keys.redstone[..n], feed(tag), price as u128, t as u64 * 1_000);
    let ix = w.redstone_ix(m, which, payload);
    w.send(&[compute_limit(), ix])
}

/// Attested primary + RedStone check (60 s strict inside its 120 s window), one Window `[T, T + 300]`.
fn cross_checked() -> (World, Pubkey) {
    let mut w = World::regular(version(attested_policy(), Some(redstone(b"TSLA", 120, 60))), 1);
    let m = w.open(regular_window(0, T, 300, 0));
    (w, m)
}

fn plain_attested() -> (World, Pubkey) {
    let mut w = World::regular(version(attested_policy(), None), 1);
    let m = w.open(regular_window(0, T, 300, 0));
    (w, m)
}

#[test]
fn settle_waits_for_the_check_bound_then_settles_single_source() {
    let (mut w, m) = cross_checked();
    attest(&mut w, m, 0, 100 * E8, T, T + 60);
    attest(&mut w, m, 1, 101 * E8, T + 300, T + 360);
    w.h.warp_to(T + 300 + 120);
    assert_eq!(w.settle(m).unwrap_err(), CROSS_CHECK_PENDING, "an early settler can't skip the check");
    w.h.warp_to(T + 300 + 121);
    w.settle(m).unwrap();
    let (market, result) = (w.h.market_state(&m), w.result_state(&m));
    assert_eq!((market.state, market.payout_yes, market.payout_no, market.flags & MARKET_FLAG_SINGLE_SOURCE), (1, 10_000_000, 0, MARKET_FLAG_SINGLE_SOURCE));
    assert_eq!((result.market, result.series, result.rent_payer), (m, w.series, key(3).pubkey()));
    assert_eq!((result.winner, result.single_source, result.void_reason, result.policy_version, result.resolved_ts), (0, 1, 0, 0, T + 421));
    assert_eq!((result.open.price, result.close.price, result.check_open.source), (100 * E8, 101 * E8, 0));
    // Resolving twice fails at `init` of the existing MarketResult, before the handler (D-019 precedence).
    assert!(w.void(m).is_err() && w.settle(m).is_err(), "a Window resolves once");
}

#[test]
fn a_present_diverging_check_voids_even_with_the_other_check_missing() {
    let (mut w, m) = cross_checked();
    attest(&mut w, m, 0, 100 * E8, T, T + 60);
    redstone_print(&mut w, m, 2, b"TSLA", 100_30_000_000, T, T + 70, 5).unwrap(); // 30 bps above the primary open
    attest(&mut w, m, 1, 101 * E8, T + 300, T + 360);
    w.h.warp_to(T + 300 + 121);
    w.settle(m).unwrap();
    let (market, result) = (w.h.market_state(&m), w.result_state(&m));
    assert_eq!((market.state, market.void_reason, market.payout_yes, market.payout_no), (2, 2, 5_000_000, 5_000_000));
    assert_eq!((result.winner, result.void_reason, result.single_source, result.check_open.price), (2, 2, 0, 100_30_000_000));
}

#[test]
fn agreeing_checks_settle_at_once_and_a_tie_goes_up() {
    let (mut w, m) = cross_checked();
    attest(&mut w, m, 0, 100 * E8, T, T + 60);
    redstone_print(&mut w, m, 2, b"TSLA", 100_10_000_000, T, T + 70, 5).unwrap(); // 10 bps
    redstone_print(&mut w, m, 3, b"TSLA", 100_05_000_000, T + 300, T + 310, 5).unwrap(); // 5 bps
    attest(&mut w, m, 1, 100 * E8, T + 300, T + 361);
    w.settle(m).unwrap();
    let result = w.result_state(&m);
    assert_eq!((result.winner, result.payout_yes, result.payout_no, result.single_source), (0, 10_000_000, 0, 0), "close == open → Up (PD-3)");
}

#[test]
fn a_lower_close_pays_down() {
    let (mut w, m) = plain_attested();
    attest(&mut w, m, 0, 100 * E8, T, T + 60);
    attest(&mut w, m, 1, 100 * E8 - 1, T + 300, T + 360);
    w.settle(m).unwrap();
    let result = w.result_state(&m);
    assert_eq!((result.winner, result.payout_yes, result.payout_no), (1, 0, 10_000_000));
}

/// Intraday race at `T + 900` for one source: `record(w, m, now)` sends the opening print.
fn race_intraday(make: fn() -> (World, Pubkey), record: fn(&mut World, Pubkey, i64) -> Result<agari_events_tests::Sent, u32>) {
    let deadline = T + 900;
    let (mut at, m) = make();
    at.h.warp_to(deadline);
    assert_eq!(at.void(m).unwrap_err(), SETTLEMENT_WINDOW_OPEN, "at the deadline the print is still admissible");
    record(&mut at, m, deadline).expect("the print lands at the deadline");

    let (mut after, m) = make();
    assert_eq!(record(&mut after, m, deadline + 1).unwrap_err(), PRINT_TOO_LATE, "one second late");
    after.h.warp_to(deadline + 1);
    after.void(m).unwrap();
    let result = after.result_state(&m);
    assert_eq!((result.winner, result.void_reason, result.payout_yes, result.payout_no), (2, 1, 5_000_000, 5_000_000));
    assert!(after.void(m).is_err(), "a Window resolves once");
}

#[test]
fn pd6_race_pyth_attested_and_redstone_at_t_plus_900() {
    fn pyth_world() -> (World, Pubkey) {
        let mut w = World::regular(version(pyth_policy(), None), 1);
        let m = w.open(regular_window(0, T, 300, 0));
        (w, m)
    }
    fn pyth_record(w: &mut World, m: Pubkey, now: i64) -> Result<agari_events_tests::Sent, u32> {
        let update = w.put_price_update(pyth_solana_receiver_sdk::ID, &pyth_fixture());
        w.h.warp_to(now);
        let ix = w.pyth_ix(m, update, 0);
        w.send(&[ix])
    }
    race_intraday(pyth_world, pyth_record);

    fn attested_record(w: &mut World, m: Pubkey, now: i64) -> Result<agari_events_tests::Sent, u32> {
        w.h.warp_to(now);
        let pair = w.attested_pair(&w.keys.attestor, m, 0, 100 * E8, T, T + 60);
        w.send(&pair)
    }
    race_intraday(plain_attested, attested_record);

    fn redstone_world() -> (World, Pubkey) {
        let mut w = World::regular(version(redstone(b"NVDA", 900, 300), None), 1);
        let m = w.open(regular_window(0, T, 300, 0));
        (w, m)
    }
    fn redstone_record(w: &mut World, m: Pubkey, now: i64) -> Result<agari_events_tests::Sent, u32> {
        redstone_print(w, m, 0, b"NVDA", 185 * E8, T, now, 3)
    }
    race_intraday(redstone_world, redstone_record);
}

#[test]
fn pd6_race_gap_open_until_lock_at() {
    let make = || {
        let mut w = World::new(series_args(1, GAP_CADENCE_SEC, 1), gap_version(version(redstone(b"TSLA", 900, 300), None)), 1);
        let m = w.open(gap_window_0925(0, 0));
        (w, m)
    };
    let (mut at, m) = make();
    assert_eq!(at.h.market_state(&m).open_deadline, GAP_LOCK_0927);
    at.h.warp_to(GAP_LOCK_0927);
    assert_eq!(at.void(m).unwrap_err(), SETTLEMENT_WINDOW_OPEN);
    redstone_print(&mut at, m, 0, b"TSLA", 365 * E8, CLOSE_0925, GAP_LOCK_0927, 3).expect("Friday's print lands at the Sunday lock");

    let (mut after, m) = make();
    assert_eq!(redstone_print(&mut after, m, 0, b"TSLA", 365 * E8, CLOSE_0925, GAP_LOCK_0927 + 1, 3).unwrap_err(), PRINT_TOO_LATE);
    after.void(m).unwrap();
    assert_eq!(after.h.market_state(&m).void_reason, 1, "voids before the Monday expiry");
}

#[test]
fn pd6_race_check_print_against_single_source_settlement_at_close_plus_120() {
    let make = || {
        let (mut w, m) = cross_checked();
        attest(&mut w, m, 0, 100 * E8, T, T + 60);
        redstone_print(&mut w, m, 2, b"TSLA", 100 * E8, T, T + 70, 5).unwrap();
        attest(&mut w, m, 1, 101 * E8, T + 300, T + 360);
        (w, m)
    };
    let bound = T + 300 + 120;
    let (mut at, m) = make();
    at.h.warp_to(bound);
    assert_eq!(at.settle(m).unwrap_err(), CROSS_CHECK_PENDING);
    redstone_print(&mut at, m, 3, b"TSLA", 101 * E8, T + 300, bound, 3).expect("the check close lands at the bound");
    at.settle(m).unwrap();
    assert_eq!(at.result_state(&m).single_source, 0);

    let (mut after, m) = make();
    assert_eq!(redstone_print(&mut after, m, 3, b"TSLA", 101 * E8, T + 300, bound + 1, 3).unwrap_err(), PRINT_TOO_LATE);
    after.settle(m).unwrap();
    assert_eq!(after.result_state(&m).single_source, 1);
}
