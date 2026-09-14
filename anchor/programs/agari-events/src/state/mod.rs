//! Engine accounts, byte-exact per `events-accounts.md` §3 (D-006). Every account is `#[account(zero_copy)]`
//! (`repr(C)`, `bytemuck::Pod`) with explicit padding; `layout_tests.rs` asserts every size and offset.

pub mod book;
pub mod config;
pub mod enums;
pub mod ledger;
pub mod market;
pub mod policy;
pub mod result;
pub mod series;
pub mod view;

#[cfg(test)]
mod layout_tests;

pub use book::*;
pub use config::*;
pub use enums::*;
pub use ledger::*;
pub use market::*;
pub use policy::*;
pub use result::*;
pub use series::*;

/// Devnet rent: `(account bytes + 128) × 5,080` lamports (measured 2026-09-13).
pub const fn rent_lamports(account_bytes: usize) -> u64 {
    (account_bytes as u64 + 128) * 5_080
}
