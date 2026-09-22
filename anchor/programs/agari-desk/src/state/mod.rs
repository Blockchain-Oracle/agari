//! Desk accounts, byte-exact per desk.md §2. Every account is `#[account(zero_copy)]` (`repr(C)`, `bytemuck::Pod`)
//! with explicit padding; `layout_tests.rs` asserts every size and offset.

pub mod config;
pub mod desk;
pub mod reference;

#[cfg(test)]
mod layout_tests;

pub use config::*;
pub use desk::*;
pub use reference::*;
