//! Shared by every Agari program (plan P§3.1 `agari-common`; spec `docs/plan/specs/`).
//!
//! - `grid`: the exact 0.001 grid and checked cash/payout math (events-engine.md §1, §8).
//! - `seeds`: PDA seeds and address helpers for every engine account (events-accounts.md §2).
//! - `place_result`: the `PlaceResult` return data products read after an engine CPI (events-accounts.md §5).
//! - `view`: `load_checked` for products reading engine accounts without deserializing (events-accounts.md §6).
//!
//! - `book_walk`: filtered level walks, VWAP, exit walk and stake quote over a Book (events-engine.md §9), mirrored in
//!   `packages/core/src/market/book-math.ts` with shared vectors.
//! - `print`: pure per-source print verifiers and normalization (prints.md §4).

pub mod book_walk;
pub mod grid;
pub mod place_result;
pub mod seeds;
pub mod print;
pub mod view;
