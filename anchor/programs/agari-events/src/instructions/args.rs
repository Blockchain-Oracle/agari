//! Borsh instruction arguments (events-instructions.md §1). Zero-copy state doesn't derive Borsh, so policy
//! versions travel as a Borsh mirror and are converted into the account layout (padding zeroed).

use anchor_lang::prelude::*;

use crate::constants::{MAX_ATTESTORS, MAX_PROGRAM_AUTHORITIES, MAX_REDSTONE_SIGNERS, MAX_ROLLERS};
use crate::state::{PolicyVersion, PrintPolicy};

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct SetAuthoritiesArgs {
    pub rollers: [Pubkey; MAX_ROLLERS],
    pub attestors: [Pubkey; MAX_ATTESTORS],
    pub redstone_signers: [[u8; 20]; MAX_REDSTONE_SIGNERS],
    pub redstone_signer_count: u8,
    pub redstone_threshold: u8,
    pub switchboard_queue: Pubkey,
    pub switchboard_min_oracles: u8,
    pub program_authorities: [Pubkey; MAX_PROGRAM_AUTHORITIES],
    pub result_retention_sec: u32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct RegisterSeriesArgs {
    pub ticker: u16,
    pub cadence_sec: u32,
    pub basis: u8,
    pub lot_base: u64,
    pub tick_base: u64,
    pub min_lots: u64,
    pub seat_bond: u64,
    pub min_rest_slots: u32,
    pub max_lead_sec: u32,
    pub fills_cap: u8,
    pub evictions_cap: u8,
}

/// Borsh mirror of `PrintPolicy` (events-accounts.md §3.2) without padding.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct PrintPolicyArgs {
    pub source: u8,
    pub grace_sec: u16,
    pub feed_id: [u8; 32],
    pub min_delay_sec: u16,
    pub bar_len_sec: u16,
    pub max_conf_bps: u16,
    pub max_slot_age: u16,
    pub open_admission_sec: u32,
    pub close_admission_sec: u32,
    pub strict_sec: u32,
}

/// Borsh mirror of `PolicyVersion` (events-accounts.md §3.3) without padding.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct PolicyVersionArgs {
    pub valid_from_ts: i64,
    pub valid_until_ts: i64,
    pub primary: PrintPolicyArgs,
    pub check: PrintPolicyArgs,
    pub max_divergence_bps: u16,
    pub check_admission_sec: u32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct OpenWindowArgs {
    pub index: u64,
    pub trading_start: i64,
    pub lock_at: i64,
    pub expiry: i64,
    pub policy_version: u8,
    pub open_kind: u8,
    pub close_kind: u8,
}

impl From<PrintPolicyArgs> for PrintPolicy {
    fn from(a: PrintPolicyArgs) -> Self {
        PrintPolicy {
            source: a.source,
            _pad0: 0,
            grace_sec: a.grace_sec,
            feed_id: a.feed_id,
            min_delay_sec: a.min_delay_sec,
            bar_len_sec: a.bar_len_sec,
            max_conf_bps: a.max_conf_bps,
            max_slot_age: a.max_slot_age,
            open_admission_sec: a.open_admission_sec,
            close_admission_sec: a.close_admission_sec,
            strict_sec: a.strict_sec,
        }
    }
}

impl From<PolicyVersionArgs> for PolicyVersion {
    fn from(a: PolicyVersionArgs) -> Self {
        PolicyVersion {
            valid_from_ts: a.valid_from_ts,
            valid_until_ts: a.valid_until_ts,
            primary: a.primary.into(),
            check: a.check.into(),
            max_divergence_bps: a.max_divergence_bps,
            _pad0: [0; 2],
            check_admission_sec: a.check_admission_sec,
        }
    }
}
