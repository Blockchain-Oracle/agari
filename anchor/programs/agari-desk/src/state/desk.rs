//! `Desk` PDA `["desk", owner]` (desk.md §2): one owner's account. The operator may trade inside it; nothing ever
//! leaves it except to the owner. The PDA itself owns the desk's associated token accounts and signs their transfers.

use anchor_lang::prelude::*;

use crate::constants::{CAP_WINDOW_SEC, MAX_TOKENS};

/// 40 B. A slot is free while `mint` is the default key.
#[zero_copy]
#[derive(Debug, Default, PartialEq, Eq)]
pub struct DeskToken {
    pub mint: Pubkey,
    /// 0 blocks buys. Sells stay allowed so the desk can always exit.
    pub enabled: u8,
    pub _pad: [u8; 7],
}

impl DeskToken {
    pub fn is_free(&self) -> bool {
        self.mint == Pubkey::default()
    }
}

/// 528 B struct, 536 B account.
#[account(zero_copy)]
pub struct Desk {
    /// Set once, never changes.
    pub owner: Pubkey,
    /// The default key means revoked.
    pub operator: Pubkey,
    /// `sha256(head ‖ seq ‖ decision_hash)`: a hash chain over the record, from 32 zero bytes.
    pub head: [u8; 32],
    /// +1 on every sealed action, gap free.
    pub seq: u64,
    /// USDC E6.
    pub per_action_cap: u64,
    pub daily_cap: u64,
    pub spent_in_window: u64,
    /// The fixed 24 h spending window starts here (Shijima `Desk.sol` `_spend`).
    pub window_start_sec: i64,
    pub tokens: [DeskToken; MAX_TOKENS],
    /// A buy must not pay more than this above its reference.
    pub max_premium_bps: u16,
    /// 0 practice (checkpoints only), 1 ask first, 2 on its own. 1 and 2 are the same to the program.
    pub mode: u8,
    pub paused: u8,
    /// 1 = every buy must carry a fully verified Pyth `Equity.Index` update and is measured against it.
    pub require_pyth_index: u8,
    pub bump: u8,
    pub token_count: u8,
    pub _pad0: u8,
    pub _reserved: [u8; 64],
}

impl Desk {
    pub fn is_operator(&self, key: &Pubkey) -> bool {
        self.operator != Pubkey::default() && self.operator == *key
    }

    pub fn is_paused(&self) -> bool {
        self.paused != 0
    }

    /// The slot holding `mint`, if any.
    pub fn token_index(&self, mint: &Pubkey) -> Option<usize> {
        self.tokens.iter().position(|t| !t.is_free() && t.mint == *mint)
    }

    /// The first free slot, if any.
    pub fn free_slot(&self) -> Option<usize> {
        self.tokens.iter().position(DeskToken::is_free)
    }

    /// How much the operator may still spend in the current window, as the UI shows it.
    pub fn remaining_daily_cap(&self, now: i64) -> u64 {
        if now >= self.window_start_sec.saturating_add(CAP_WINDOW_SEC) {
            return self.daily_cap;
        }
        self.daily_cap.saturating_sub(self.spent_in_window)
    }
}
