//! Engine constants (events-accounts.md §2, amended by D-013). Grid and payout constants live in
//! `agari_common::grid` and are re-exported here so the program has one place to read them from.

pub use agari_common::grid::{MAX_PRICE_TICKS, MIN_PRICE_TICKS, PAIR_TICKS, PAYOUT_DENOMINATOR, PAYOUT_VOID};

pub const MAX_FILLS_CAP: u8 = 32;
pub const MAX_EVICTIONS_CAP: u8 = 16;
/// Expired nodes skipped (not evicted) per placement before matching stops (`StopReason::SkipCap`).
pub const MAX_SKIPS: u8 = 64;
pub const MAX_OPEN_ORDERS_PER_SEAT: u16 = 16;
pub const MAX_CANCEL_HANDLES: usize = 16;

pub const LEDGER_INITIAL_SEATS: u16 = 96;
pub const LEDGER_MAX_SEATS: u16 = 1_024;
/// `116 × 88 = 10,208 B`, the most one `public_grow_ledger` realloc can add (`MAX_PERMITTED_DATA_INCREASE`).
pub const LEDGER_GROW_MAX: u16 = 116;
pub const LEDGER_HEADER_LEN: usize = 96;
pub const SEAT_LEN: usize = 88;

pub const BOOK_CAPACITY_SMALL: u32 = 256;
pub const BOOK_CAPACITY_LARGE: u32 = 512;
/// Price levels per side, indexed by price ticks (index 0 unused).
pub const PRICE_LEVELS: usize = 1_000;
pub const BOOK_FIXED_LEN: usize = 32_384;
pub const ORDER_NODE_LEN: usize = 48;
/// A Book node ref of 0 means "none"; refs are 1-based so a zeroed Book is a valid empty book.
pub const NIL_REF: u32 = 0;

pub const MAX_POLICY_VERSIONS: usize = 8;
pub const MAX_FREE_BOOKS: usize = 4;
pub const MAX_ROLLERS: usize = 4;
pub const MAX_ATTESTORS: usize = 4;
pub const MAX_PROGRAM_AUTHORITIES: usize = 8;
pub const MAX_REDSTONE_SIGNERS: usize = 5;

/// The Gap Series `cadence_sec` seed: one Window a week (= core `GAP_CADENCE_SEC`, D-013).
pub const GAP_CADENCE_SEC: u32 = 604_800;
/// Regular/Token cadences divide one hour, so a boundary on the ET clock is `ts % cadence == 0` (D-013).
pub const CADENCE_DIVIDES_SEC: u32 = 3_600;
/// Fri 16:00 → Tue 09:30 over a holiday Monday, with room to spare.
pub const MAX_GAP_DURATION_SEC: i64 = 432_000;
/// `open_admission_sec` sentinel: the Gap opening print is admissible until `lock_at` (prints.md §3).
pub const ADMIT_UNTIL_LOCK: u32 = u32::MAX;
pub const DEFAULT_RESULT_RETENTION_SEC: u32 = 21_600;

/// Every recorded print is normalized to price × 10⁻⁸.
pub const PRINT_EXPO: i32 = -8;
/// Domain tag at the start of an attested print message (prints.md §4.3).
pub const ATTEST_DOMAIN: &[u8; 14] = b"agari-print-v1";
pub const ATTEST_MESSAGE_LEN: usize = 158;

/// `config.cluster_tag` values = core `CLUSTER_ID` (D-012, D-013).
pub const CLUSTER_MAINNET_BETA: u8 = 101;
pub const CLUSTER_DEVNET: u8 = 103;
pub const CLUSTER_LOCALNET: u8 = 104;

pub const fn is_cluster_tag(tag: u8) -> bool {
    matches!(tag, CLUSTER_MAINNET_BETA | CLUSTER_DEVNET | CLUSTER_LOCALNET)
}
