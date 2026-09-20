//! The reserve's balance sheet, as pure transitions over its own fields.
//!
//! `outstanding_base` is provider capital out on the venue at cost: the sum of `fronted` over live positions.
//! `user_owed_base` is custody money that is an owner's and not yet collected. Liquid capital is whatever else
//! custody holds, so it is derived from the token account rather than mirrored in a counter that could drift.
//! Providers hold shares of `liquid + outstanding`. Nothing here touches an account or a token: the instructions
//! move the money and call these to keep the books, and `tests` drives the same methods against a simulated custody.

use anchor_lang::prelude::*;

use crate::constants::{LEVERAGE_ONE_BPS, MAX_OPEN};
use crate::errors::LeverageError;
use crate::math::{split, BPS};
use crate::state::{Position, PositionStatus, WindowBook};

/// The reserve's tunables, mirrored by `LeverageParams` in `packages/core/src/leverage/types.ts`.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug, Default, PartialEq, Eq)]
pub struct LeverageParams {
    /// 20,000 = 2x. Exposure is `leverage_bps / 10,000` of the stake.
    pub max_leverage_bps: u32,
    /// Charged on the fronted amount at open and kept whatever happens: the reserve's gap-risk fee.
    pub premium_bps: u16,
    /// The knock-out line: anyone may sell a position once `mark × 10,000 < fronted × maintenance_bps`.
    pub maintenance_bps: u16,
    /// Aggregate fronted cap as a fraction of total value.
    pub max_exposure_bps: u16,
    pub max_open_positions: u16,
    /// No opens inside the last seconds of a Window, where the knock-out cannot act before the print.
    pub min_time_left_sec: u32,
    /// Entry only inside this band, in the bought side's own terms: no boost on a decided Window.
    pub min_entry_price_raw: u64,
    pub max_entry_price_raw: u64,
    pub max_fronted_per_position_base: u64,
    pub max_window_fronted_base: u64,
}

impl LeverageParams {
    pub fn validate(&self) -> std::result::Result<(), LeverageError> {
        let bps = BPS as u16;
        let ok = self.max_leverage_bps > LEVERAGE_ONE_BPS
            && self.premium_bps < bps
            && self.maintenance_bps >= bps
            && self.max_exposure_bps <= bps
            && self.max_open_positions > 0
            && usize::from(self.max_open_positions) <= MAX_OPEN
            && self.min_entry_price_raw > 0
            && self.min_entry_price_raw < self.max_entry_price_raw
            && self.max_fronted_per_position_base > 0
            && self.max_window_fronted_base > 0;
        if ok {
            Ok(())
        } else {
            Err(LeverageError::BadParams)
        }
    }
}

/// One live position as the reserve tracks it. `position_id` 0 is a free slot.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug, Default, PartialEq, Eq)]
pub struct OpenSlot {
    pub position_id: u64,
    pub expiry_sec: i64,
}

/// What a sale or a redemption did to a position's books.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct ExitSplit {
    pub reclaimed_base: u64,
    pub returned_base: u64,
    /// Every contract is gone and the position is closed.
    pub finished: bool,
}

#[account]
#[derive(InitSpace)]
pub struct LeverageReserve {
    pub admin: Pubkey,
    pub collateral_mint: Pubkey,
    pub params: LeverageParams,
    pub outstanding_base: u64,
    pub user_owed_base: u64,
    pub supply_shares: u64,
    pub next_position_id: u64,
    pub paused: bool,
    pub bump: u8,
    pub seat_bump: u8,
    pub custody_bump: u8,
    /// Live positions, so a withdrawal can see an expired unsettled one without being handed any accounts.
    pub open: [OpenSlot; MAX_OPEN],
}

impl LeverageReserve {
    pub fn liquid_base(&self, custody_balance: u64) -> u64 {
        custody_balance.saturating_sub(self.user_owed_base)
    }

    pub fn total_value_base(&self, custody_balance: u64) -> u64 {
        self.liquid_base(custody_balance).saturating_add(self.outstanding_base)
    }

    pub fn open_count(&self) -> usize {
        self.open.iter().filter(|s| s.position_id != 0).count()
    }

    /// The first live position whose Window has expired: what blocks a withdrawal until somebody settles it.
    pub fn unsettled_expired(&self, now: i64) -> Option<u64> {
        self.open.iter().find(|s| s.position_id != 0 && s.expiry_sec <= now).map(|s| s.position_id)
    }

    /// Shares for a supply, priced against total value. The first supply mints one share per unit.
    pub fn shares_for(&self, custody_balance: u64, amount_base: u64) -> std::result::Result<u64, LeverageError> {
        let total = self.total_value_base(custody_balance);
        if self.supply_shares == 0 || total == 0 {
            return Ok(amount_base);
        }
        u64::try_from(u128::from(amount_base) * u128::from(self.supply_shares) / u128::from(total)).map_err(|_| LeverageError::MathOverflow)
    }

    /// What `shares` redeem for, out of liquid capital only, and only once every expired position is settled: a
    /// provider must not be able to leave with their share of a loss the books have not taken yet.
    pub fn amount_for(&self, custody_balance: u64, shares: u64, now: i64) -> std::result::Result<u64, LeverageError> {
        if self.unsettled_expired(now).is_some() {
            return Err(LeverageError::UnsettledPosition);
        }
        let total = self.total_value_base(custody_balance);
        if total == 0 || self.supply_shares == 0 {
            return Err(LeverageError::NoEquity);
        }
        if shares > self.supply_shares {
            return Err(LeverageError::InsufficientShares);
        }
        let amount = u64::try_from(u128::from(shares) * u128::from(total) / u128::from(self.supply_shares)).map_err(|_| LeverageError::MathOverflow)?;
        if amount == 0 {
            return Err(LeverageError::ZeroAmount);
        }
        if amount > self.liquid_base(custody_balance) {
            return Err(LeverageError::InsufficientLiquidity);
        }
        Ok(amount)
    }

    /// Books a front after the fill. `liquid_before` is liquid capital before the owner's stake arrived; the premium
    /// is the reserve's at once, so the front may come out of it. Then the three caps, after the front is booked, as
    /// the reference checks them: per position, per Window, and overall.
    pub fn book_front(&mut self, liquid_before: u64, fronted_base: u64, premium_base: u64, window: &mut WindowBook, position_id: u64, expiry_sec: i64) -> std::result::Result<(), LeverageError> {
        let funds = liquid_before.checked_add(premium_base).ok_or(LeverageError::MathOverflow)?;
        if funds < fronted_base {
            return Err(LeverageError::InsufficientLiquidity);
        }
        let liquid_after = funds - fronted_base;
        self.outstanding_base = self.outstanding_base.checked_add(fronted_base).ok_or(LeverageError::MathOverflow)?;
        window.fronted_base = window.fronted_base.checked_add(fronted_base).ok_or(LeverageError::MathOverflow)?;
        window.positions_open = window.positions_open.checked_add(1).ok_or(LeverageError::MathOverflow)?;

        let p = self.params;
        if fronted_base > p.max_fronted_per_position_base {
            return Err(LeverageError::OverPositionCap);
        }
        if window.fronted_base > p.max_window_fronted_base {
            return Err(LeverageError::OverWindowCap);
        }
        let total = u128::from(liquid_after) + u128::from(self.outstanding_base);
        if u128::from(self.outstanding_base) * BPS > total * u128::from(p.max_exposure_bps) {
            return Err(LeverageError::OverExposure);
        }
        if self.open_count() >= usize::from(p.max_open_positions) {
            return Err(LeverageError::TooManyOpen);
        }
        let slot = self.open.iter_mut().find(|s| s.position_id == 0).ok_or(LeverageError::TooManyOpen)?;
        *slot = OpenSlot { position_id, expiry_sec };
        Ok(())
    }

    /// Books what a sale or a redemption fetched: the reserve's claim first, the rest to the owner. A partial sale
    /// leaves the position Live with fewer contracts and a smaller claim. A full exit books whatever claim went
    /// unrecovered as the reserve's loss, and closes the position.
    ///
    /// Releases saturate rather than refuse: nothing may trap an exit. `tests` proves they never run short.
    pub fn book_exit(&mut self, position: &mut Position, window: &mut WindowBook, ended_as: PositionStatus, lots_sold: u64, proceeds_base: u64, now: i64) -> ExitSplit {
        let (reclaimed, returned) = split(u128::from(proceeds_base), u128::from(position.fronted_base));
        let (reclaimed, returned) = (reclaimed as u64, returned as u64);
        position.lots = position.lots.saturating_sub(lots_sold);
        position.fronted_base -= reclaimed;
        position.proceeds_base = position.proceeds_base.saturating_add(proceeds_base);
        position.reclaimed_base = position.reclaimed_base.saturating_add(reclaimed);
        position.returned_base = position.returned_base.saturating_add(returned);

        let mut released = reclaimed;
        let finished = position.lots == 0;
        if finished {
            released = released.saturating_add(position.fronted_base);
            position.fronted_base = 0;
            position.status = ended_as;
            position.exited_at_sec = now;
            window.positions_open = window.positions_open.saturating_sub(1);
            if let Some(slot) = self.open.iter_mut().find(|s| s.position_id == position.position_id) {
                *slot = OpenSlot::default();
            }
        }
        self.outstanding_base = self.outstanding_base.saturating_sub(released);
        window.fronted_base = window.fronted_base.saturating_sub(released);
        ExitSplit { reclaimed_base: reclaimed, returned_base: returned, finished }
    }

    /// The owner's part of an exit could not be paid at once and waits in custody for `public_claim`.
    pub fn book_owed(&mut self, position: &mut Position, amount_base: u64) -> std::result::Result<(), LeverageError> {
        position.owed_base = position.owed_base.checked_add(amount_base).ok_or(LeverageError::MathOverflow)?;
        self.user_owed_base = self.user_owed_base.checked_add(amount_base).ok_or(LeverageError::MathOverflow)?;
        Ok(())
    }

    pub fn book_claim(&mut self, position: &mut Position) -> u64 {
        let amount = position.owed_base;
        position.owed_base = 0;
        self.user_owed_base = self.user_owed_base.saturating_sub(amount);
        amount
    }
}
