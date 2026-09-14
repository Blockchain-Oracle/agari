//! Launch timestamps (D-003), Series args and PD-1 policy versions.

use agari_events::constants::{ADMIT_UNTIL_LOCK, GAP_CADENCE_SEC};
use agari_events::instructions::{OpenWindowArgs, PolicyVersionArgs, PrintPolicyArgs, RegisterSeriesArgs, SetAuthoritiesArgs};
use anchor_lang::prelude::Pubkey;
use solana_signer::Signer;

use crate::harness::key;

/// 2026-09-11 00:00:00Z: v1 of the launch versions starts here.
pub const TRIAL_FROM: i64 = 1_789_084_800;
/// Fri 2026-09-25 20:00:00Z (16:00 EDT): the last Pyth-trial close; TSLA v2 starts here.
pub const CLOSE_0925: i64 = 1_790_366_400;
/// Fri 2026-09-25 19:50:00Z.
pub const FRI_1950: i64 = CLOSE_0925 - 600;
/// Sun 2026-09-27 20:00 EDT = Mon 2026-09-28 00:00:00Z: the Gap lock.
pub const GAP_LOCK_0927: i64 = CLOSE_0925 + 187_200;
/// Mon 2026-09-28 09:30 EDT = 13:30:00Z: the Gap close boundary.
pub const OPEN_0928: i64 = CLOSE_0925 + 235_800;

pub const TSLA: u16 = 1;
pub const NVDA: u16 = 2;
pub const QQQ: u16 = 8;

pub const PROGRAM_SEAT_A: Pubkey = Pubkey::new_from_array([0xA0; 32]);
pub const PROGRAM_SEAT_D: Pubkey = Pubkey::new_from_array([0xD0; 32]);

/// The roller (key 2), five RedStone signers (threshold 3), two PROGRAM seats at indices 0 and 3.
pub fn authorities() -> SetAuthoritiesArgs {
    let mut program_authorities = [Pubkey::default(); 8];
    program_authorities[0] = PROGRAM_SEAT_A;
    program_authorities[3] = PROGRAM_SEAT_D;
    SetAuthoritiesArgs {
        rollers: [key(2).pubkey(), Pubkey::default(), Pubkey::default(), Pubkey::default()],
        attestors: [Pubkey::new_from_array([0xE0; 32]), Pubkey::default(), Pubkey::default(), Pubkey::default()],
        redstone_signers: [[0x8b; 20], [0xde; 20], [0x51; 20], [0xdd; 20], [0x9c; 20]],
        redstone_signer_count: 5,
        redstone_threshold: 3,
        switchboard_queue: Pubkey::default(),
        switchboard_min_oracles: 0,
        program_authorities,
        result_retention_sec: 21_600,
    }
}

/// The launch grid: lot = tick = 1,000 base units on 6-dp collateral.
pub fn series_args(ticker: u16, cadence_sec: u32, basis: u8) -> RegisterSeriesArgs {
    RegisterSeriesArgs {
        ticker,
        cadence_sec,
        basis,
        lot_base: 1_000,
        tick_base: 1_000,
        min_lots: 1_000,
        seat_bond: 250_000,
        min_rest_slots: 50,
        max_lead_sec: 400_000,
        fills_cap: 16,
        evictions_cap: 16,
    }
}

pub fn gap_series_args(ticker: u16) -> RegisterSeriesArgs {
    series_args(ticker, GAP_CADENCE_SEC, 1)
}

fn feed(tag: &[u8]) -> [u8; 32] {
    let mut f = [0u8; 32];
    f[..tag.len()].copy_from_slice(tag);
    f
}

pub fn pyth(feed_byte: u8) -> PrintPolicyArgs {
    PrintPolicyArgs { source: 1, grace_sec: 5, feed_id: [feed_byte; 32], max_conf_bps: 50, open_admission_sec: 900, close_admission_sec: 900, ..Default::default() }
}

pub fn redstone(tag: &[u8], admission: u32, strict_sec: u32) -> PrintPolicyArgs {
    PrintPolicyArgs { source: 2, feed_id: feed(tag), strict_sec, open_admission_sec: admission, close_admission_sec: admission, ..Default::default() }
}

/// TSLA v1: Pyth primary + RedStone check (60 s strict inside the 120 s check window), until the 09-25 close.
pub fn tsla_v1() -> PolicyVersionArgs {
    PolicyVersionArgs {
        valid_from_ts: TRIAL_FROM,
        valid_until_ts: CLOSE_0925,
        primary: pyth(0x16),
        check: redstone(b"TSLA", 120, 60),
        max_divergence_bps: 25,
        check_admission_sec: 120,
    }
}

/// TSLA v2: RedStone from the 09-25 close, open-ended.
pub fn tsla_v2() -> PolicyVersionArgs {
    PolicyVersionArgs { valid_from_ts: CLOSE_0925, valid_until_ts: i64::MAX, primary: redstone(b"TSLA", 900, 300), ..Default::default() }
}

/// The Gap flavour of a version: the opening print is admissible until `lock_at`.
pub fn gap_version(mut v: PolicyVersionArgs) -> PolicyVersionArgs {
    v.primary.open_admission_sec = ADMIT_UNTIL_LOCK;
    v
}

/// QQQ v1: Pyth only, until the 09-25 close (then paused).
pub fn qqq_v1() -> PolicyVersionArgs {
    PolicyVersionArgs { valid_from_ts: TRIAL_FROM, valid_until_ts: CLOSE_0925, primary: pyth(0x96), ..Default::default() }
}

/// A clock-aligned Regular/Token Window `[start, start + cadence]` at `index` on `version`.
pub fn regular_window(index: u64, start: i64, cadence: i64, version: u8) -> OpenWindowArgs {
    OpenWindowArgs { index, trading_start: start, lock_at: start + cadence, expiry: start + cadence, policy_version: version, open_kind: 0, close_kind: 0 }
}

/// The 09-25 "Monday Gap": Fri 16:00 → Mon 09:30 ET, locked Sun 20:00 ET.
pub fn gap_window_0925(index: u64, version: u8) -> OpenWindowArgs {
    OpenWindowArgs { index, trading_start: CLOSE_0925, lock_at: GAP_LOCK_0927, expiry: OPEN_0928, policy_version: version, open_kind: 2, close_kind: 1 }
}
