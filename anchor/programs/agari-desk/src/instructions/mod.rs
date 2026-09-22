//! Instruction account structs and handlers, one file per group (desk.md §4). `lib.rs` only dispatches here.

pub mod admin;
pub mod checkpoint;
pub mod controls;
pub mod funding;
pub mod open;
pub mod reference;
pub mod swap;
pub mod swap_rules;

pub use admin::*;
pub use checkpoint::*;
pub use controls::*;
pub use funding::*;
pub use open::*;
pub use reference::*;
pub use swap::*;
