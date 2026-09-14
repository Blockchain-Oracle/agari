//! Instruction handlers (events-instructions.md). `lib.rs` only dispatches here.

pub mod admin_init_config;
pub mod admin_series;
pub mod admin_set_authorities;
pub mod args;
pub mod policy_rules;
pub mod roller_open_window;
pub mod window_rules;

pub use admin_init_config::*;
pub use admin_series::*;
pub use admin_set_authorities::*;
pub use args::*;
pub use roller_open_window::*;

// S2 lane P: prints.
pub mod copy_open_from_prev;
pub mod print_rules;
pub mod record_print_sources;

pub use copy_open_from_prev::*;
pub use record_print_sources::*;
