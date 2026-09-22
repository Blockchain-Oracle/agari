//! Shared LiteSVM harness for agari-events integration tests (S2).
//!
//! - `harness`: a fresh VM with agari-events deployed upgradeable (so `admin_init_config`'s upgrade-authority
//!   check is real), a 6-dp collateral mint, a treasury, deterministic keys, clock warps and a `send` that
//!   returns CU, transaction bytes or the program error code.
//! - `ix`: instruction builders for every agari-events instruction built so far.
//! - `fixtures`: launch timestamps, Series args and D-003 policy versions.
//! - `read`: zero-copy account readers (unaligned copies of the on-chain layouts).

pub mod fixtures;
pub mod harness;
pub mod ix;
pub mod read;
pub mod trade;

pub use harness::{Harness, Sent};

// S2 lane P: prints, settle and void helpers.
pub mod prints;

// S2.12–S2.13: redeem and closure.
pub mod settlement;

// S7a: agari-vault world, builders and invariants.
pub mod vault;
pub mod vault_ix;
pub mod vault_trade;

// S21: agari-desk world, Token-2022 fixtures and instruction builders.
pub mod desk;
pub mod desk_ix;
pub mod desk_token;
