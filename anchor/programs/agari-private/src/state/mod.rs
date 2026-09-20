//! What the desk holds, and every way money moves through it, as pure methods over plain accounts.
//!
//! The instruction handlers move tokens and call the engine; the books are kept here, so the randomized test drives
//! exactly the code the chain runs. One identity holds after every call: custody = `owed` + `pool` + `in_slots`.

mod desk;
mod slot;

pub use desk::*;
pub use slot::*;

#[cfg(test)]
mod random;
#[cfg(test)]
mod tests;
