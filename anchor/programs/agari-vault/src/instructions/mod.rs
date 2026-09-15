//! Instruction account structs and handlers, one file per group (vault.md §3).

pub mod admin_init_vault;
pub mod crank;
pub mod funding;
pub mod grants;
pub mod open_account;
pub mod place;

pub use admin_init_vault::*;
pub use crank::*;
pub use funding::*;
pub use grants::*;
pub use open_account::*;
pub use place::*;
