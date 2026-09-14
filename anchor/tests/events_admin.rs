//! Admin, policy versions and `roller_open_window` on LiteSVM (S2.4). Codes are the engine's (events-accounts.md §4).

use agari_events::constants::{LEDGER_INITIAL_SEATS, MAX_PROGRAM_AUTHORITIES};
use agari_events::state::SEAT_FLAG_PROGRAM;
use agari_events_tests::fixtures::*;
use agari_events_tests::harness::key;
use agari_events_tests::ix::window_accounts;
use agari_events_tests::Harness;
use anchor_lang::prelude::Pubkey;
use solana_signer::Signer;

const NOT_ADMIN: u32 = 6001;
const INVALID_MODE: u32 = 6000;
const NOT_ROLLER: u32 = 6002;
const BAD_ALIGNMENT: u32 = 6006;
const BAD_HORIZON: u32 = 6007;
const NO_FREE_BOOK: u32 = 6008;
const UNKNOWN_POLICY_VERSION: u32 = 6011;
const POLICY_VERSION_IMMUTABLE: u32 = 6012;
const SOURCE_NOT_COVERED: u32 = 6013;
const BAD_POLICY: u32 = 6014;

fn configured() -> Harness {
    let mut h = Harness::new();
    h.setup_config(authorities());
    h
}

#[test]
fn init_config_requires_the_upgrade_authority() {
    let mut h = Harness::new();
    let stranger = key(3);
    let ix = h.init_config_ix(&stranger.pubkey(), 103);
    assert_eq!(h.send(&[ix], &[&stranger]).unwrap_err(), NOT_ADMIN, "a front-runner can't take the config");
    h.setup_config(authorities());
    let config = h.config_state();
    assert_eq!((config.admin, config.collateral_mint, config.treasury), (key(1).pubkey(), h.mint, h.treasury));
    assert_eq!((config.mode, config.collateral_decimals, config.cluster_tag, config.redstone_signer_count), (0, 6, 103, 5));
}

#[test]
fn mode_and_authorities_are_admin_only() {
    let mut h = configured();
    let stranger = key(3);
    let ix = h.set_mode_ix(&stranger.pubkey(), 1);
    assert_eq!(h.send(&[ix], &[&stranger]).unwrap_err(), NOT_ADMIN);
    let ix = h.set_authorities_ix(&stranger.pubkey(), authorities());
    assert_eq!(h.send(&[ix], &[&stranger]).unwrap_err(), NOT_ADMIN);
    let admin = key(1);
    let ix = h.set_mode_ix(&admin.pubkey(), 3);
    assert_eq!(h.send(&[ix], &[&admin]).unwrap_err(), INVALID_MODE);
}

#[test]
fn policy_versions_are_append_only_and_validated() {
    let mut h = configured();
    let series = h.register_series(series_args(TSLA, 300, 0));
    h.add_policy(&series, 0, tsla_v1()).unwrap();
    assert_eq!(h.add_policy(&series, 0, tsla_v2()).unwrap_err(), POLICY_VERSION_IMMUTABLE);
    assert_eq!(h.add_policy(&series, 2, tsla_v2()).unwrap_err(), UNKNOWN_POLICY_VERSION);

    let mut slow_check = tsla_v2();
    slow_check.valid_from_ts = CLOSE_0925;
    slow_check.primary = pyth(0x16);
    slow_check.check = redstone(b"TSLA", 120, 120);
    slow_check.max_divergence_bps = 25;
    slow_check.check_admission_sec = 120;
    assert_eq!(h.add_policy(&series, 1, slow_check).unwrap_err(), BAD_POLICY, "RedStone check strict_sec must be < 120");

    let mut same_source = tsla_v1();
    same_source.check = pyth(0x17);
    same_source.check.open_admission_sec = 120;
    same_source.check.close_admission_sec = 120;
    assert_eq!(h.add_policy(&series, 1, same_source).unwrap_err(), BAD_POLICY, "check source must differ");

    assert_eq!(h.add_policy(&series, 1, gap_version(tsla_v2())).unwrap_err(), BAD_POLICY, "ADMIT_UNTIL_LOCK is Gap-only");
    h.add_policy(&series, 1, tsla_v2()).unwrap();
    assert_eq!(h.series_state(&series).version_count, 2);
}

#[test]
fn open_window_picks_the_highest_covering_version() {
    let mut h = configured();
    let tsla = h.register_series(series_args(TSLA, 300, 0));
    h.add_policy(&tsla, 0, tsla_v1()).unwrap();
    h.add_policy(&tsla, 1, tsla_v2()).unwrap();
    let tsla_book = h.add_book(&tsla, 512);
    let gap = h.register_series(gap_series_args(TSLA));
    h.add_policy(&gap, 0, gap_version(tsla_v1())).unwrap();
    h.add_policy(&gap, 1, gap_version(tsla_v2())).unwrap();
    let gap_book = h.add_book(&gap, 256);
    let qqq = h.register_series(series_args(QQQ, 300, 0));
    h.add_policy(&qqq, 0, qqq_v1()).unwrap();
    let qqq_book = h.add_book(&qqq, 512);
    h.warp_to(FRI_1950);

    // Friday's last 5m Window (19:55 → 20:00Z) is v1's, not v2's.
    let last = regular_window(0, CLOSE_0925 - 300, 300, 1);
    assert_eq!(h.open_window(&tsla, &tsla_book, last).unwrap_err(), SOURCE_NOT_COVERED);
    let sent = h.open_window(&tsla, &tsla_book, regular_window(0, CLOSE_0925 - 300, 300, 0)).unwrap();
    let market = h.market_state(&window_accounts(&tsla, 0).market);
    assert_eq!((market.policy_version, market.open_deadline, market.close_deadline), (0, CLOSE_0925 - 300 + 900, CLOSE_0925 + 900));
    assert!(sent.tx_bytes <= 1_232 && sent.compute_units < 200_000, "{sent:?}");
    println!("roller_open_window: {} CU, {} tx bytes", sent.compute_units, sent.tx_bytes);

    // The 09-25 Gap Window is covered by v2 only; its opening print is admissible until lock_at.
    assert_eq!(h.open_window(&gap, &gap_book, gap_window_0925(0, 0)).unwrap_err(), SOURCE_NOT_COVERED);
    h.open_window(&gap, &gap_book, gap_window_0925(0, 1)).unwrap();
    let gap_market = h.market_state(&window_accounts(&gap, 0).market);
    assert_eq!((gap_market.open_deadline, gap_market.close_deadline, gap_market.basis), (GAP_LOCK_0927, OPEN_0928 + 900, 1));

    // QQQ after 20:00Z: no version covers it, so it isn't listed.
    let after_close = regular_window(0, CLOSE_0925, 300, 0);
    assert_eq!(h.open_window(&qqq, &qqq_book, after_close).unwrap_err(), SOURCE_NOT_COVERED);
}

#[test]
fn open_window_preallocates_program_seats_and_binds_a_free_book() {
    let mut h = configured();
    let nvda = h.register_series(series_args(NVDA, 300, 0));
    h.add_policy(&nvda, 0, tsla_v2()).unwrap();
    let first_book = h.add_book(&nvda, 512);
    let start = OPEN_0928;
    h.warp_to(start - 60);
    h.open_window(&nvda, &first_book, regular_window(0, start, 300, 0)).unwrap();

    let w = window_accounts(&nvda, 0);
    let (ledger, seats) = h.ledger_state(&w.ledger);
    assert_eq!((ledger.market, ledger.capacity, ledger.seats_used, ledger.seat_bond), (w.market, LEDGER_INITIAL_SEATS, MAX_PROGRAM_AUTHORITIES as u16, 250_000));
    assert_eq!((seats[0].owner, seats[0].flags), (PROGRAM_SEAT_A, SEAT_FLAG_PROGRAM));
    assert_eq!((seats[3].owner, seats[3].flags), (PROGRAM_SEAT_D, SEAT_FLAG_PROGRAM));
    assert!(seats.iter().enumerate().filter(|(i, _)| *i != 0 && *i != 3).all(|(_, s)| s.owner == Pubkey::default() && s.flags == 0));

    let market = h.market_state(&w.market);
    assert_eq!((market.book, market.ledger, market.mvault, market.event_seq, market.state), (first_book, w.ledger, w.mvault, 1, 0));
    let vault = h.token_account(&w.mvault);
    assert_eq!((vault.mint, vault.owner, vault.amount), (h.mint, w.market, 0));
    let book = h.book_state(&first_book);
    assert_eq!((book.market, book.generation), (w.market, 1));
    let series = h.series_state(&nvda);
    assert_eq!((series.free_book_count, series.next_index, series.last_expiry), (0, 1, start + 300));

    // The bound Book isn't free, so the next Window needs another one.
    let next = regular_window(1, start + 300, 300, 0);
    assert_eq!(h.open_window(&nvda, &first_book, next).unwrap_err(), NO_FREE_BOOK);
    let second_book = h.add_book(&nvda, 256);
    h.open_window(&nvda, &second_book, next).unwrap();
    assert_eq!(h.book_state(&second_book).generation, 1);
    assert_eq!(h.series_state(&nvda).free_book_count, 0);
}

#[test]
fn open_window_refuses_strangers_halts_and_misaligned_windows() {
    let mut h = configured();
    let hourly = h.register_series(series_args(NVDA, 3_600, 0));
    h.add_policy(&hourly, 0, tsla_v2()).unwrap();
    let hourly_book = h.add_book(&hourly, 256);
    let five = h.register_series(series_args(TSLA, 300, 0));
    h.add_policy(&five, 0, tsla_v2()).unwrap();
    let five_book = h.add_book(&five, 512);
    let gap = h.register_series(gap_series_args(NVDA));
    h.add_policy(&gap, 0, gap_version(tsla_v2())).unwrap();
    let gap_book = h.add_book(&gap, 256);
    h.warp_to(OPEN_0928 - 60);

    let stranger = key(3);
    let aligned = regular_window(0, OPEN_0928, 300, 0);
    assert_eq!(h.open_window_as(&stranger, &five, &five_book, aligned).unwrap_err(), NOT_ROLLER);

    let partial_hour = regular_window(0, OPEN_0928, 1_800, 0);
    assert_eq!(h.open_window(&hourly, &hourly_book, partial_hour).unwrap_err(), BAD_ALIGNMENT, "09:30 → 10:00 on the 60m lane");
    let off_clock = regular_window(0, OPEN_0928 + 60, 300, 0);
    assert_eq!(h.open_window(&five, &five_book, off_clock).unwrap_err(), BAD_ALIGNMENT);
    let mut too_long = gap_window_0925(0, 0);
    too_long.trading_start = OPEN_0928 - 60 - 432_001 + 120;
    too_long.expiry = too_long.trading_start + 432_001;
    too_long.lock_at = OPEN_0928;
    assert_eq!(h.open_window(&gap, &gap_book, too_long).unwrap_err(), BAD_HORIZON);

    let admin = key(1);
    let halt = h.set_mode_ix(&admin.pubkey(), 1);
    h.ok(&[halt], &[&admin]);
    assert_eq!(h.open_window(&five, &five_book, aligned).unwrap_err(), INVALID_MODE, "ReduceOnly blocks listing");
    let resume = h.set_mode_ix(&admin.pubkey(), 0);
    h.ok(&[resume], &[&admin]);
    h.open_window(&five, &five_book, aligned).unwrap();
}
