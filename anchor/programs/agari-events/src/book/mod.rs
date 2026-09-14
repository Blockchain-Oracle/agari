//! The on-chain order book over a zero-copy `Book` and its node slice: node allocation (`slab`) and price
//! levels with bitmaps (`ladder`), and the Book as book-walk input (`walk`). Pure functions over plain references, so native tests drive them directly.

pub mod ladder;
pub mod slab;
pub mod walk;

pub use ladder::*;
pub use slab::*;
pub use walk::*;
