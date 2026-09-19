//! The reserve's balance sheet, as pure transitions over its own fields.
//!
//! Two counters carry it, the same two the range reserve uses. `user_escrow_base` is vault money that is not the
//! providers': live stakes, and payouts or refunds a ticket has been awarded but not yet collected. `locked_base`
//! is provider capital promised to live tickets. Provider equity is whatever else the vault holds, so a lost stake
//! becomes the providers' simply by leaving escrow, with no transfer.
//!
//! Nothing here touches an account or a token: the instructions move the money and call these to keep the books,
//! and the randomized test in `tests` drives the same methods against a simulated vault.

use anchor_lang::prelude::*;

use crate::constants::{EXPIRY_SLOTS, MAX_LEGS, MIN_LEGS};
use crate::errors::ParlayError;
use crate::math::BPS;

/// The reserve's tunables, mirrored by `ParlayParams` in `packages/core/src/parlay/types.ts`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug, Default, PartialEq, Eq)]
pub struct ParlayParams {
    pub margin_bps: u16,
    pub max_exposure_bps: u16,
    /// The floor a same-instant combination is held to, as a fraction of its cheapest leg.
    pub correlation_bps: u16,
    /// The widest gap between a leg's price and the other side's touch the reserve will price through. 0 = off.
    pub max_spread_ticks: u16,
    pub max_legs: u8,
    /// A floor under each Series' own `min_rest_slots`: only orders that have rested this long price a leg (PD-2).
    pub min_rest_slots: u32,
    pub min_time_left_sec: u32,
    pub max_payout_cap_base: u64,
    pub max_expiry_locked_base: u64,
    pub min_combined_prob_raw: u64,
    /// The least depth a leg is priced over, in payout base units; a bigger payout is priced over its own size.
    pub price_depth_raw: u64,
}

impl ParlayParams {
    pub fn validate(&self) -> std::result::Result<(), ParlayError> {
        let bps = BPS as u16;
        let legs = usize::from(self.max_legs);
        let ok = self.margin_bps <= bps
            && self.max_exposure_bps <= bps
            && self.correlation_bps <= bps
            && (MIN_LEGS..=MAX_LEGS).contains(&legs)
            && self.max_payout_cap_base > 0
            && self.max_expiry_locked_base > 0
            && self.price_depth_raw > 0;
        if ok {
            Ok(())
        } else {
            Err(ParlayError::BadParams)
        }
    }
}

/// Provider capital coming due at one boundary. A slot with nothing locked is free, whatever instant it names.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug, Default, PartialEq, Eq)]
pub struct ExpiryLock {
    pub expiry_sec: i64,
    pub locked_base: u64,
}

/// How a ticket left the live book.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Settled {
    Won,
    Lost,
    Void,
}

#[account]
#[derive(InitSpace)]
pub struct ParlayReserve {
    pub admin: Pubkey,
    pub collateral_mint: Pubkey,
    pub events_program: Pubkey,
    pub params: ParlayParams,
    pub user_escrow_base: u64,
    pub locked_base: u64,
    pub supply_shares: u64,
    pub next_parlay_id: u64,
    pub tickets_open: u64,
    pub paused: bool,
    pub bump: u8,
    pub vault_bump: u8,
    /// Capital per settlement instant, so the reserve cannot put its whole book on one print.
    pub expiry_locks: [ExpiryLock; EXPIRY_SLOTS],
}

/// Each instant once, in the order first seen: a ticket locks its payout against a boundary once however many of
/// its legs share it.
pub fn distinct(expiries: &[i64]) -> impl Iterator<Item = i64> + '_ {
    expiries.iter().enumerate().filter(|(i, e)| !expiries[..*i].contains(e)).map(|(_, e)| *e)
}

impl ParlayReserve {
    pub fn equity_base(&self, vault_balance: u64) -> u64 {
        vault_balance.saturating_sub(self.user_escrow_base)
    }

    pub fn free_base(&self, vault_balance: u64) -> u64 {
        self.equity_base(vault_balance).saturating_sub(self.locked_base)
    }

    pub fn locked_at(&self, expiry_sec: i64) -> u64 {
        self.expiry_locks.iter().find(|s| s.locked_base > 0 && s.expiry_sec == expiry_sec).map_or(0, |s| s.locked_base)
    }

    /// Liquidity first (an empty reserve says so plainly), then the exposure limit, then the per-boundary limit.
    pub fn check_capacity(&self, vault_balance: u64, house_locked_base: u64, expiries: &[i64]) -> std::result::Result<(), ParlayError> {
        if house_locked_base > self.free_base(vault_balance) {
            return Err(ParlayError::InsufficientLiquidity);
        }
        let locked_after = self.locked_base.checked_add(house_locked_base).ok_or(ParlayError::MathOverflow)?;
        let cap = u128::from(self.equity_base(vault_balance)) * u128::from(self.params.max_exposure_bps) / (BPS as u128);
        if u128::from(locked_after) > cap {
            return Err(ParlayError::OverExposure);
        }
        for expiry in distinct(expiries) {
            let after = self.locked_at(expiry).checked_add(house_locked_base).ok_or(ParlayError::MathOverflow)?;
            if after > self.params.max_expiry_locked_base {
                return Err(ParlayError::OverExpiryCap);
            }
        }
        Ok(())
    }

    /// A ticket opens: its stake enters escrow and the rest of its payout is promised out of provider capital.
    /// `vault_balance` is the vault before the stake lands in it.
    pub fn book_open(&mut self, vault_balance: u64, stake_base: u64, house_locked_base: u64, expiries: &[i64]) -> std::result::Result<u64, ParlayError> {
        self.check_capacity(vault_balance, house_locked_base, expiries)?;
        for expiry in distinct(expiries) {
            let at = self
                .expiry_locks
                .iter()
                .position(|s| s.locked_base > 0 && s.expiry_sec == expiry)
                .or_else(|| self.expiry_locks.iter().position(|s| s.locked_base == 0))
                .ok_or(ParlayError::TooManyExpiries)?;
            let slot = &mut self.expiry_locks[at];
            slot.expiry_sec = expiry;
            slot.locked_base = slot.locked_base.checked_add(house_locked_base).ok_or(ParlayError::MathOverflow)?;
        }
        let parlay_id = self.next_parlay_id;
        self.next_parlay_id = parlay_id.checked_add(1).ok_or(ParlayError::MathOverflow)?;
        self.locked_base = self.locked_base.checked_add(house_locked_base).ok_or(ParlayError::MathOverflow)?;
        self.user_escrow_base = self.user_escrow_base.checked_add(stake_base).ok_or(ParlayError::MathOverflow)?;
        self.tickets_open = self.tickets_open.checked_add(1).ok_or(ParlayError::MathOverflow)?;
        Ok(parlay_id)
    }

    /// A ticket leaves the live book. The reserve's capital is no longer promised either way; what changes is who
    /// the escrow belongs to. Won: the stake stops being escrow and the whole payout is owed instead. Lost: the
    /// stake becomes the providers'. Void: the stake stays owed to its buyer.
    ///
    /// Releases saturate rather than refuse. Nothing may trap a payout or a refund, so a counter that somehow ran
    /// short must not be able to stop a ticket from finishing; `tests` proves they never do run short.
    pub fn book_settled(&mut self, how: Settled, stake_base: u64, house_locked_base: u64, max_payout_base: u64, expiries: &[i64]) -> std::result::Result<(), ParlayError> {
        self.locked_base = self.locked_base.saturating_sub(house_locked_base);
        self.tickets_open = self.tickets_open.saturating_sub(1);
        for expiry in distinct(expiries) {
            if let Some(slot) = self.expiry_locks.iter_mut().find(|s| s.locked_base > 0 && s.expiry_sec == expiry) {
                slot.locked_base = slot.locked_base.saturating_sub(house_locked_base);
            }
        }
        let without_stake = self.user_escrow_base.saturating_sub(stake_base);
        self.user_escrow_base = match how {
            Settled::Won => without_stake.checked_add(max_payout_base).ok_or(ParlayError::MathOverflow)?,
            Settled::Lost => without_stake,
            Settled::Void => self.user_escrow_base,
        };
        Ok(())
    }

    /// A payout or a refund leaves the vault for its ticket's owner.
    pub fn book_claim(&mut self, amount_base: u64) {
        self.user_escrow_base = self.user_escrow_base.saturating_sub(amount_base);
    }

    /// Shares for a supply, priced against provider equity. The first supply mints one share per unit.
    pub fn shares_for(&self, vault_balance: u64, amount_base: u64) -> std::result::Result<u64, ParlayError> {
        let equity = self.equity_base(vault_balance);
        if self.supply_shares == 0 || equity == 0 {
            return Ok(amount_base);
        }
        u64::try_from(u128::from(amount_base) * u128::from(self.supply_shares) / u128::from(equity)).map_err(|_| ParlayError::MathOverflow)
    }

    /// What `shares` redeem for, refused when it would take capital that is backing a live ticket.
    pub fn amount_for(&self, vault_balance: u64, shares: u64) -> std::result::Result<u64, ParlayError> {
        let equity = self.equity_base(vault_balance);
        if equity == 0 || self.supply_shares == 0 {
            return Err(ParlayError::NoEquity);
        }
        if shares > self.supply_shares {
            return Err(ParlayError::InsufficientShares);
        }
        let amount = u64::try_from(u128::from(shares) * u128::from(equity) / u128::from(self.supply_shares)).map_err(|_| ParlayError::MathOverflow)?;
        if amount == 0 {
            return Err(ParlayError::ZeroAmount);
        }
        if amount > self.free_base(vault_balance) {
            return Err(ParlayError::InsufficientLiquidity);
        }
        Ok(amount)
    }
}
