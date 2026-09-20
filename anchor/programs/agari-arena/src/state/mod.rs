//! What the arena holds, and every way a match and its money move, as pure methods over plain accounts.
//!
//! The instruction handlers move tokens and call the engine; the rules are kept here, so the randomized test drives
//! exactly the code the chain runs. One identity holds after every call: custody = `escrowed` + `credited` +
//! `agent_escrow`. The arena prices nothing: a pick's cost is what the engine charged and a card's payout is what the
//! engine paid. The pot is the only money it decides.

mod arena;
mod game;
mod pot;
mod season;

pub use arena::*;
pub use game::*;
pub use season::*;

#[cfg(test)]
mod random;
#[cfg(test)]
mod tests;
