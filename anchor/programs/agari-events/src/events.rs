//! Engine events (events-accounts.md §5). Market-scoped events are emitted with `emit_cpi!` and carry
//! `seq = ++market.event_seq`, so `(market, seq)` has no gaps. Admin events carry no `seq`; the admin
//! instructions' account lists have no event-CPI accounts, so they use `emit!` (the indexer reads config and
//! Series state directly). Event structs are added with the instruction step that first emits them.

use anchor_lang::prelude::*;

#[event]
pub struct ConfigInitialized {
    pub config: Pubkey,
    pub admin: Pubkey,
    pub collateral_mint: Pubkey,
    pub cluster_tag: u8,
}

#[event]
pub struct AuthoritiesSet {
    pub config: Pubkey,
}

#[event]
pub struct ModeSet {
    pub mode: u8,
}

#[event]
pub struct SeriesRegistered {
    pub series: Pubkey,
    pub ticker: u16,
    pub cadence_sec: u32,
    pub basis: u8,
    pub cash_unit: u64,
}

#[event]
pub struct BookAdded {
    pub series: Pubkey,
    pub book: Pubkey,
    pub capacity: u16,
}

#[event]
pub struct PolicyVersionAdded {
    pub series: Pubkey,
    pub index: u8,
    pub valid_from_ts: i64,
    pub valid_until_ts: i64,
    pub primary_source: u8,
    pub check_source: u8,
}

#[event]
pub struct WindowOpened {
    pub market: Pubkey,
    pub series: Pubkey,
    pub seq: u64,
    pub index: u64,
    pub trading_start: i64,
    pub lock_at: i64,
    pub expiry: i64,
    pub open_deadline: i64,
    pub close_deadline: i64,
    pub policy_version: u8,
    pub open_kind: u8,
    pub close_kind: u8,
    pub basis: u8,
    pub book: Pubkey,
    pub ledger: Pubkey,
    pub mvault: Pubkey,
    pub generation: u32,
}

/// Borsh mirror of the zero-copy `Print` (events-accounts.md §3.5) for event payloads.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct PrintData {
    pub price: i64,
    pub source_ts: i64,
    pub expo: i32,
    pub source: u8,
    pub signers: u8,
    pub flags: u8,
}

impl From<&crate::state::Print> for PrintData {
    fn from(p: &crate::state::Print) -> Self {
        Self { price: p.price, source_ts: p.source_ts, expo: p.expo, source: p.source, signers: p.signers, flags: p.flags }
    }
}

#[event]
pub struct PrintRecorded {
    pub market: Pubkey,
    pub seq: u64,
    pub which: u8,
    pub source: u8,
    pub price: i64,
    pub expo: i32,
    pub source_ts: i64,
    pub signers: u8,
    pub copied: bool,
    pub recorded_ts: i64,
}

#[event]
pub struct WindowResolved {
    pub market: Pubkey,
    pub seq: u64,
    pub state: u8,
    pub winner: u8,
    pub payout_yes: u32,
    pub payout_no: u32,
    pub void_reason: u8,
    pub single_source: bool,
    pub open: PrintData,
    pub close: PrintData,
    pub check_open: PrintData,
    pub check_close: PrintData,
    pub resolved_ts: i64,
}
