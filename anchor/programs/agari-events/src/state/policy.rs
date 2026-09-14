//! PD-1 price policies (events-accounts.md §3.2–3.3; prints.md §2). Versions are append-only and immutable.

use anchor_lang::prelude::*;

use super::enums::{Source, Which};

/// How one source must prove a print. 56 B, align 4.
#[zero_copy]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct PrintPolicy {
    pub source: u8,
    pub _pad0: u8,
    pub grace_sec: u16,
    /// Pyth feed id / RedStone ASCII id left-aligned zero-padded / Switchboard feed hash / attested source hash.
    pub feed_id: [u8; 32],
    pub min_delay_sec: u16,
    pub bar_len_sec: u16,
    pub max_conf_bps: u16,
    pub max_slot_age: u16,
    /// `ADMIT_UNTIL_LOCK` allowed for the Gap open.
    pub open_admission_sec: u32,
    pub close_admission_sec: u32,
    pub strict_sec: u32,
}

/// One dated policy version of a Series. 136 B, align 8.
#[zero_copy]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct PolicyVersion {
    /// Inclusive.
    pub valid_from_ts: i64,
    /// Inclusive; `i64::MAX` = open-ended.
    pub valid_until_ts: i64,
    pub primary: PrintPolicy,
    /// `source == None` means no check.
    pub check: PrintPolicy,
    pub max_divergence_bps: u16,
    pub _pad0: [u8; 2],
    pub check_admission_sec: u32,
}

impl PolicyVersion {
    /// Covers both boundaries of a Window (prints.md §2.3).
    pub const fn covers(&self, trading_start: i64, expiry: i64) -> bool {
        self.valid_from_ts <= trading_start && expiry <= self.valid_until_ts
    }

    pub fn has_check(&self) -> bool {
        self.check.source != u8::from(Source::None)
    }

    /// The primary policy for Open/Close, the check policy for CheckOpen/CheckClose.
    pub const fn policy_for(&self, which: Which) -> &PrintPolicy {
        if which.is_check() {
            &self.check
        } else {
            &self.primary
        }
    }
}
