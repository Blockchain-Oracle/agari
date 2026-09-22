//! Seeds, the singleton address, limits and the money scales (desk.md §1–§2). The config PDA is derived at compile
//! time, so account constraints compare 32 bytes instead of hashing, and the IDL carries its address.

use anchor_lang::prelude::Pubkey;

pub const DESK_CONFIG_SEED: &[u8] = b"desk-config";
pub const DESK_SEED: &[u8] = b"desk";
pub const DESK_REF_SEED: &[u8] = b"desk-ref";

/// `["desk-config"]`.
pub const DESK_CONFIG: Pubkey = {
    let (address, _) = anchor_lang::derive_program_address(&[DESK_CONFIG_SEED], &crate::ID_CONST.to_bytes());
    Pubkey::new_from_array(address)
};

/// The attested reference message (desk.md §3): domain ‖ program ‖ cluster_tag ‖ mint ‖ 3 × u64 ‖ i64.
pub const REF_DOMAIN: &[u8; 17] = b"agari-desk-ref-v1";
pub const REF_MESSAGE_LEN: usize = 114;

pub const MAX_ATTESTORS: usize = 4;
/// Names one desk may hold (the eight PreStocks names today).
pub const MAX_TOKENS: usize = 8;
/// PreStocks mints are Token-2022 with 9 dp; the collateral is USDC at 6 dp.
pub const TOKEN_DECIMALS: u8 = 9;
pub const USDC_DECIMALS: u8 = 6;

/// A posted reference older than this refuses operator trades; a post may be at most this old, and 5 s "early".
pub const REFERENCE_MAX_AGE_SEC: i64 = 900;
pub const REFERENCE_FUTURE_SLACK_SEC: i64 = 5;
/// The Pyth index leg must be fresher than this (desk.md §4.5 step 8).
pub const PYTH_MAX_AGE_SEC: i64 = 60;
/// The caps' fixed spending window (Shijima `Desk.sol` `_spend`).
pub const CAP_WINDOW_SEC: i64 = 86_400;

/// `10^(9 + 12 + 8 − 6)`: raw × multiplier_e12 × price_e8 / VALUE_SCALE = USDC E6.
pub const VALUE_SCALE: u128 = 100_000_000_000_000_000_000_000;
pub const E11: u128 = 100_000_000_000;
pub const E12: u128 = 1_000_000_000_000;
pub const BPS: u128 = 10_000;
/// `(10000 − 800) / 10000` reduced: what must come back, 8 % inside the attested price.
pub const BAND_KEEP_NUM: u128 = 92;
pub const BAND_KEEP_DEN: u128 = 100;

pub const MODE_PRACTICE: u8 = 0;
pub const MODE_ASK_FIRST: u8 = 1;
pub const MODE_ON_ITS_OWN: u8 = 2;

/// `Bought.reference_source`.
pub const REFERENCE_MARK: u8 = 0;
pub const REFERENCE_PYTH_INDEX: u8 = 1;

/// Core `CLUSTER_ID`: 101 mainnet, 103 devnet, 104 localnet (D-012).
pub const fn is_cluster_tag(tag: u8) -> bool {
    matches!(tag, 101 | 103 | 104)
}

pub const fn is_mode(mode: u8) -> bool {
    mode <= MODE_ON_ITS_OWN
}
