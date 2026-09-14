//! `Market` (the Window) PDA `["market", series, index u64]` and `Print` (events-accounts.md §3.5–3.6).

use anchor_lang::prelude::*;

use super::enums::{MarketState, MarketStatus, Which};

/// A recorded print, normalized to expo −8. 24 B, align 8. `source == 0` means the slot is empty.
#[zero_copy]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct Print {
    pub price: i64,
    pub source_ts: i64,
    pub expo: i32,
    pub source: u8,
    pub signers: u8,
    pub flags: u8,
    pub _pad0: u8,
}

impl Print {
    pub const fn is_empty(&self) -> bool {
        self.source == 0
    }
}

/// 448 B struct, 456 B account. `MarketId` = this account's address.
#[account(zero_copy)]
pub struct Market {
    pub series: Pubkey,
    pub book: Pubkey,
    pub ledger: Pubkey,
    pub mvault: Pubkey,
    pub rent_payer: Pubkey,
    pub index: u64,
    /// The open boundary T.
    pub trading_start: i64,
    pub lock_at: i64,
    /// The close boundary T.
    pub expiry: i64,
    pub open_deadline: i64,
    pub close_deadline: i64,
    pub open: Print,
    pub close: Print,
    pub check_open: Print,
    pub check_close: Print,
    pub backing_lots: u64,
    pub volume_cash: u64,
    pub volume_lots: u64,
    pub trade_count: u64,
    pub last_trade_ts: i64,
    pub event_seq: u64,
    pub resolved_ts: i64,
    pub payout_yes: u32,
    pub payout_no: u32,
    pub dependents: u32,
    pub last_price: u16,
    pub policy_version: u8,
    pub open_kind: u8,
    pub close_kind: u8,
    pub basis: u8,
    pub state: u8,
    pub void_reason: u8,
    pub flags: u8,
    pub bump: u8,
    pub ledger_bump: u8,
    pub mvault_bump: u8,
    pub _reserved: [u8; 64],
}

impl Market {
    pub fn is_terminal(&self) -> bool {
        self.state != u8::from(MarketState::Open)
    }

    /// events-engine.md §7: a stored terminal state wins; otherwise the clock decides.
    pub fn status(&self, now: i64) -> MarketStatus {
        match MarketState::try_from(self.state) {
            Ok(MarketState::Resolved) => MarketStatus::Resolved,
            Ok(MarketState::Voided) => MarketStatus::Voided,
            _ if now < self.trading_start => MarketStatus::Listed,
            _ if now < self.lock_at => MarketStatus::Trading,
            _ => MarketStatus::Locked,
        }
    }

    /// The boundary a print slot is taken at: `trading_start` for Open/CheckOpen, `expiry` for Close/CheckClose.
    pub const fn boundary(&self, which: Which) -> i64 {
        if which.is_open() {
            self.trading_start
        } else {
            self.expiry
        }
    }

    pub const fn print(&self, which: Which) -> &Print {
        match which {
            Which::Open => &self.open,
            Which::Close => &self.close,
            Which::CheckOpen => &self.check_open,
            Which::CheckClose => &self.check_close,
        }
    }

    pub fn print_mut(&mut self, which: Which) -> &mut Print {
        match which {
            Which::Open => &mut self.open,
            Which::Close => &mut self.close,
            Which::CheckOpen => &mut self.check_open,
            Which::CheckClose => &mut self.check_close,
        }
    }

    /// `seq = ++event_seq` for every Market-scoped event, so `(market, seq)` has no gaps.
    pub fn next_seq(&mut self) -> Option<u64> {
        self.event_seq = self.event_seq.checked_add(1)?;
        Some(self.event_seq)
    }
}
