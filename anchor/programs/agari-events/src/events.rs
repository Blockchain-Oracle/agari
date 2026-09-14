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

/// A handle in events and instruction args: 0-based node index + sequence (`u32::MAX` = none).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct OrderHandle {
    pub node: u32,
    pub seq: u64,
}

impl OrderHandle {
    pub const NONE: OrderHandle = OrderHandle { node: u32::MAX, seq: 0 };
}

/// One fill against a resting maker (66 B).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct FillRecord {
    pub maker: Pubkey,
    pub maker_seat: u16,
    pub maker_node: u32,
    pub maker_seq: u64,
    pub maker_kind: u8,
    pub path: u8,
    pub price: u16,
    pub lots: u64,
    pub maker_remaining: u64,
}

/// One order removed from the book: evicted, self-match-cancelled, cancelled or swept (58 B).
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub struct RemovedRecord {
    pub owner: Pubkey,
    pub seat: u16,
    pub node: u32,
    pub seq: u64,
    pub kind: u8,
    pub price: u16,
    pub lots: u64,
    pub reason: u8,
}

#[event]
pub struct OrderExecuted {
    pub market: Pubkey,
    pub seq: u64,
    pub taker: Pubkey,
    pub taker_seat: u16,
    pub kind: u8,
    pub order_type: u8,
    pub self_match: u8,
    pub limit_price: u16,
    pub lots: u64,
    pub expire_ts: i64,
    pub client_id: u64,
    pub filled_lots: u64,
    pub cash_spent: u64,
    pub cash_received: u64,
    pub credit_used: u64,
    pub transferred_in: u64,
    pub withdrawn: u64,
    pub rested: OrderHandle,
    pub rested_lots: u64,
    pub cancelled_lots: u64,
    pub stop_reason: u8,
    pub backing_lots: u64,
    pub fills: Vec<FillRecord>,
    pub removed: Vec<RemovedRecord>,
    pub ts: i64,
    pub slot: u64,
}

#[event]
pub struct OrdersCancelled {
    pub market: Pubkey,
    pub seq: u64,
    /// `Pubkey::default()` for a permissionless sweep.
    pub caller: Pubkey,
    pub reason: u8,
    pub removed: Vec<RemovedRecord>,
    pub skipped: u8,
    pub withdrawn: u64,
}

#[event]
pub struct OrderReduced {
    pub market: Pubkey,
    pub seq: u64,
    pub owner: Pubkey,
    pub seat: u16,
    pub handle: OrderHandle,
    pub kind: u8,
    pub price: u16,
    pub old_lots: u64,
    pub new_lots: u64,
}

#[event]
pub struct CompleteSet {
    pub market: Pubkey,
    pub seq: u64,
    pub owner: Pubkey,
    pub seat: u16,
    pub minted: bool,
    pub lots: u64,
    pub cash: u64,
    pub credit_used: u64,
    pub transferred_in: u64,
    pub withdrawn: u64,
    pub backing_lots: u64,
}

#[event]
pub struct CreditWithdrawn {
    pub market: Pubkey,
    pub seq: u64,
    pub owner: Pubkey,
    pub seat: u16,
    pub amount: u64,
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

// S2.12–S2.13: redeem and closure (events-accounts.md §5).

#[event]
pub struct Redeemed {
    pub market: Pubkey,
    pub seq: u64,
    pub owner: Pubkey,
    pub seat: u16,
    pub yes_lots: u64,
    pub no_lots: u64,
    pub payout: u64,
    pub credit: u64,
    pub bond: u64,
    pub total: u64,
    pub partial: bool,
    pub by_crank: bool,
}

#[event]
pub struct BookReleased {
    pub market: Pubkey,
    pub seq: u64,
    pub book: Pubkey,
    pub series: Pubkey,
}

#[event]
pub struct LedgerGrown {
    pub market: Pubkey,
    pub seq: u64,
    pub payer: Pubkey,
    pub capacity: u16,
}

#[event]
pub struct LedgerClosed {
    pub market: Pubkey,
    pub seq: u64,
    pub residue: u64,
}

#[event]
pub struct DependentChanged {
    pub market: Pubkey,
    pub seq: u64,
    pub program_authority: Pubkey,
    pub added: bool,
    pub dependents: u32,
}

#[event]
pub struct MarketClosed {
    pub market: Pubkey,
    pub seq: u64,
    pub result: Pubkey,
}
