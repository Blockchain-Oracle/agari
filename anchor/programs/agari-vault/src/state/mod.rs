//! Vault accounts, byte-exact per vault.md §2. Every account is `#[account(zero_copy)]` (`repr(C)`, `bytemuck::Pod`)
//! with explicit padding; `layout_tests.rs` asserts every size and offset.

pub mod account;
pub mod config;
pub mod grant;

#[cfg(test)]
mod layout_tests;

pub use account::*;
pub use config::*;
pub use grant::*;
