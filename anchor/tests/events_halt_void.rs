//! A halt voids by itself (S6 lane 6c, session-lanes.md §3.1–3.2, prints.md §4.1 step 5, §6): a halted Pyth feed
//! widens its confidence past the policy's 50 bps, no print can be recorded, and the Window voids `MissingPrint` at
//! `deadline + 1`. Nothing off-chain has to act: the chain refuses the print and anyone can void.
//!
//! The halted update is the real archived TSLA trial update (price 36,547,600 e−5, conf 6,068) with only its
//! confidence widened, so every other check (receiver owner, feed id, uniqueness at T) still passes.

use agari_events_tests::fixtures::regular_window;
use agari_events_tests::prints::*;
use anchor_lang::prelude::Pubkey;
use pyth_solana_receiver_sdk::price_update::PriceUpdateV2;

const MARKET_ALREADY_TERMINAL: u32 = 6103;
const PRINT_TOO_LATE: u32 = 6206;
const CONFIDENCE_TOO_WIDE: u32 = 6207;
const SETTLEMENT_WINDOW_OPEN: u32 = 6223;

const T: i64 = T_PYTH;
const CLOSE: i64 = T + 300;
/// `conf × 10,000 ≤ price × 50` at price 36,547,600: the widest confidence a print may carry (exactly 50 bps).
const MAX_CONF: u64 = 36_547_600 * 50 / 10_000;
const HALF: u32 = 5_000_000;

/// The archived update moved to boundary `t` (`prev = t − 1`) with confidence `conf`.
fn update_at(t: i64, conf: u64) -> PriceUpdateV2 {
    let mut u = pyth_fixture();
    (u.price_message.publish_time, u.price_message.prev_publish_time, u.price_message.conf) = (t, t - 1, conf);
    u
}

/// A 5-minute Pyth-primary Window `[T, T + 300]` (TSLA v1's primary policy: grace 5, conf 50 bps, admission 900).
fn pyth_window() -> (World, Pubkey) {
    let mut w = World::regular(version(pyth_policy(), None), 1);
    let m = w.open(regular_window(0, T, 300, 0));
    (w, m)
}

/// Posts `update` as the default receiver would have stored it and records it into `which` at `now`.
fn record(w: &mut World, m: Pubkey, which: u8, update: &PriceUpdateV2, now: i64) -> Result<agari_events_tests::Sent, u32> {
    let account = w.put_price_update(pyth_solana_receiver_sdk::ID, update);
    w.h.warp_to(now);
    let ix = w.pyth_ix(m, account, which);
    w.send(&[ix])
}

fn assert_missing_print_void(w: &World, m: &Pubkey) {
    let (market, result) = (w.h.market_state(m), w.result_state(m));
    assert_eq!((market.state, market.void_reason, market.payout_yes, market.payout_no), (2, 1, HALF, HALF), "Voided, MissingPrint, 0.5/0.5");
    assert_eq!((result.winner, result.void_reason, result.payout_yes, result.payout_no), (2, 1, HALF, HALF));
}

#[test]
fn confidence_one_unit_past_fifty_bps_is_refused_and_exactly_fifty_bps_prints() {
    let (mut w, m) = pyth_window();
    assert_eq!(record(&mut w, m, 0, &update_at(T, MAX_CONF + 1), T + 3).unwrap_err(), CONFIDENCE_TOO_WIDE, "a halted feed gives no print");
    assert_eq!(w.h.market_state(&m).open.source, 0, "the refused print leaves the slot empty");
    record(&mut w, m, 0, &update_at(T, MAX_CONF), T + 4).expect("50 bps is still inside the policy");
    assert_eq!(w.h.market_state(&m).open.price, 36_547_600_000);
}

#[test]
fn a_halted_open_voids_missing_print_at_t_plus_901_in_both_orders() {
    let wide = update_at(T, MAX_CONF * 4);
    let deadline = T + 900;

    // At the deadline only a print is admissible: the void is early and the halted print is refused on confidence.
    let (mut at, m) = pyth_window();
    assert_eq!(at.h.market_state(&m).open_deadline, deadline);
    at.h.warp_to(deadline);
    assert_eq!(at.void(m).unwrap_err(), SETTLEMENT_WINDOW_OPEN, "void first: admission is still open");
    assert_eq!(record(&mut at, m, 0, &wide, deadline).unwrap_err(), CONFIDENCE_TOO_WIDE, "then the halted print");
    assert_eq!(at.void(m).unwrap_err(), SETTLEMENT_WINDOW_OPEN, "a refused print changes nothing");
    record(&mut at, m, 0, &update_at(T, 6_068), deadline).expect("a feed that recovers by the deadline still prints");

    // One second later only the void: the print is refused on the clock before its confidence is even read.
    let (mut after, m) = pyth_window();
    assert_eq!(record(&mut after, m, 0, &wide, deadline + 1).unwrap_err(), PRINT_TOO_LATE, "print first");
    after.void(m).expect("then anyone voids");
    assert_missing_print_void(&after, &m);
    assert_eq!(after.result_state(&m).open.source, 0, "the empty open slot is what names the void");

    let (mut other, m) = pyth_window();
    other.h.warp_to(deadline + 1);
    other.void(m).expect("void first");
    assert_missing_print_void(&other, &m);
    assert_eq!(record(&mut other, m, 0, &update_at(T, 6_068), deadline + 1).unwrap_err(), MARKET_ALREADY_TERMINAL, "even a healthy print is too late");
}

#[test]
fn a_halt_at_the_close_voids_with_the_open_recorded() {
    let deadline = CLOSE + 900;
    let make = || {
        let (mut w, m) = pyth_window();
        record(&mut w, m, 0, &update_at(T, 6_068), T + 3).expect("the real open print");
        assert_eq!(record(&mut w, m, 1, &update_at(CLOSE, MAX_CONF + 1), CLOSE + 2).unwrap_err(), CONFIDENCE_TOO_WIDE, "halted at the close");
        (w, m)
    };

    let (mut at, m) = make();
    at.h.warp_to(deadline);
    assert_eq!(at.void(m).unwrap_err(), SETTLEMENT_WINDOW_OPEN);
    assert_eq!(record(&mut at, m, 1, &update_at(CLOSE, MAX_CONF + 1), deadline).unwrap_err(), CONFIDENCE_TOO_WIDE);
    assert!(at.settle(m).is_err(), "no close print, nothing to settle");

    let (mut after, m) = make();
    assert_eq!(record(&mut after, m, 1, &update_at(CLOSE, MAX_CONF + 1), deadline + 1).unwrap_err(), PRINT_TOO_LATE);
    after.void(m).expect("void at close_deadline + 1");
    assert_missing_print_void(&after, &m);
    let result = after.result_state(&m);
    assert_eq!((result.open.source, result.open.price, result.close.source), (1, 36_547_600_000, 0), "open recorded, close empty: a close-slot void");
    println!("halt-void MarketResult: open {{source {}, ts {}}} close {{source {}}} void_reason {} resolved_ts {}", result.open.source, result.open.source_ts, result.close.source, result.void_reason, result.resolved_ts);
}
