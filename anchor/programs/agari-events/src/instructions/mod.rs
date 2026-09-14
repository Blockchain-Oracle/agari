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
pub mod user_cancel_orders;
pub mod user_place_order;
pub mod user_reduce_order;
pub mod user_sets;
pub mod venue_io;

pub use user_cancel_orders::*;
pub use user_place_order::*;
pub use user_reduce_order::*;
pub use user_sets::*;
