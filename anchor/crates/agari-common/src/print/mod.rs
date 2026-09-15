//! Per-source print verifiers (prints.md §4). Pure functions over bytes or decoded inputs, the policy fields
//! they need, the boundary `T` and the clock, so each is unit-tested against real fixtures. The instruction
//! handlers own the shared slot rules (§4.0: series, slot, source, empty slot, earliest/deadline) and the
//! account and sysvar loading; these functions own everything a source's proof has to satisfy.
//!
//! Every verifier returns the source's own `(price, expo)`; `normalize` (§4.6) turns it into the stored
//! `expo −8` price. `PrintError` names map 1:1 onto `EventsError` so the engine converts without judgement.

pub mod attested;
pub mod median;
pub mod normalize;
pub mod pyth;
#[cfg(feature = "redstone")]
pub mod redstone;
/// S6 token lane (prints.md §4.4). The pure checks build without the crate; `verify_with_crate` needs `switchboard`.
pub mod switchboard;

/// A verified print before normalization (prints.md §4.1–4.4 "Output").
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct RawPrint {
    pub price: i64,
    pub expo: i32,
    /// Pyth `publish_time`; RedStone, attested and Switchboard: `T`.
    pub source_ts: i64,
    /// Pyth 0; RedStone the verified package count; attested 1; Switchboard the distinct oracles.
    pub signers: u8,
}

/// Verification failures, named exactly as the engine's error codes (events-accounts.md §4, 6200 range).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PrintError {
    InsufficientVerification,
    FeedIdMismatch,
    PrintNotUnique,
    ConfidenceTooWide,
    InvalidPrintValue,
    BadAttestation,
    UnknownAttestor,
    BadRedStonePackage,
    RedStoneTimestampMismatch,
    InsufficientRedStoneSigners,
    // S6 Switchboard (prints.md §4.4), onto the existing codes 6214–6218.
    SwitchboardFeedMismatch,
    SwitchboardQueueMismatch,
    DuplicateOracle,
    TooFewOracles,
    QuoteSlotStale,
}
