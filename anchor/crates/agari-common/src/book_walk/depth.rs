//! Depth math over outcome-terms levels (events-engine.md §9): VWAP with cost rounded up (Masayume
//! `ParlayMath.vwap`), an exact exit walk, and the stake quote (port of DreamDEX `quoteBinaryStakeOverBook` on the
//! Agari grid: `tick = lot = 1`, `one = 1000` ticks, cash = `lots × ticks × cu`).

use super::Level;
use crate::grid::{MAX_PRICE_TICKS, PAIR_TICKS};

pub const DEFAULT_SLIPPAGE_BPS: u16 = 300;
pub const DEFAULT_SLIPPAGE_MIN_TICKS: u16 = 10;

/// `(⌈Σ take × price / filled⌉, filled)` over the first `lots`; `(0, 0)` when nothing fills.
pub fn vwap_over_depth(levels: &[Level], lots: u64) -> (u64, u64) {
    let (mut cost, mut filled) = (0u128, 0u64);
    for &(price, available) in levels {
        if filled >= lots {
            break;
        }
        let take = available.min(lots - filled);
        cost += u128::from(take) * u128::from(price);
        filled += take;
    }
    if filled == 0 {
        return (0, 0);
    }
    let vwap = cost.div_ceil(u128::from(filled));
    // A VWAP of prices ≤ 999 is ≤ 999.
    (vwap as u64, filled)
}

/// `(Σ take × price, filled)` for selling up to `lots` into these levels, exact (units: ticks × lots).
pub fn exit_walk(levels: &[Level], lots: u64) -> (u128, u64) {
    let (mut proceeds, mut filled) = (0u128, 0u64);
    for &(price, available) in levels {
        if filled >= lots {
            break;
        }
        let take = available.min(lots - filled);
        proceeds += u128::from(take) * u128::from(price);
        filled += take;
    }
    (proceeds, filled)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum BuySide {
    Yes,
    No,
}

/// A stake-sized protective IOC buy.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct StakeQuote {
    /// Protective limit in the bought outcome's own terms (padded).
    pub limit_ticks: u16,
    /// The same limit in YES terms, what `user_place_order` takes.
    pub yes_price_ticks: u16,
    pub lots: u64,
    /// `lots × limit_ticks × cu`: the escrow, never above the stake.
    pub escrow_cash: u64,
}

/// Sweep cheapest-first while the escrow at the worst level touched fits the stake, pad the limit with the larger of
/// `slippage_bps` and `min_ticks` (capped at 999), then refit the lots to the stake at the padded price. `None`
/// when nothing is fillable, the refit is 0, or it is below `min_lots`.
pub fn quote_stake(levels: &[Level], side: BuySide, stake_cash: u64, cash_unit: u64, min_lots: u64, slippage_bps: u16, min_ticks: u16) -> Option<StakeQuote> {
    if stake_cash == 0 || cash_unit == 0 {
        return None;
    }
    let stake = u128::from(stake_cash);
    let cu = u128::from(cash_unit);
    let (mut taken, mut limit) = (0u128, 0u16);
    for &(price, available) in levels {
        if price == 0 || u64::from(price) >= PAIR_TICKS || available == 0 {
            continue;
        }
        let max_lots = stake / (u128::from(price) * cu);
        if max_lots <= taken {
            break;
        }
        let take = u128::from(available).min(max_lots - taken);
        taken += take;
        limit = price;
        if take < u128::from(available) {
            break;
        }
    }
    if taken == 0 {
        return None;
    }
    let percent = u32::from(limit) * u32::from(slippage_bps) / 10_000;
    let padded = (u32::from(limit) + percent.max(u32::from(min_ticks))).min(u32::from(MAX_PRICE_TICKS)) as u16;
    let affordable = stake / (u128::from(padded) * cu);
    let lots = affordable.min(taken);
    if lots == 0 || lots < u128::from(min_lots) {
        return None;
    }
    let lots = u64::try_from(lots).ok()?;
    let escrow = u64::try_from(u128::from(lots) * u128::from(padded) * cu).ok()?;
    let yes = match side {
        BuySide::Yes => padded,
        BuySide::No => PAIR_TICKS as u16 - padded,
    };
    Some(StakeQuote { limit_ticks: padded, yes_price_ticks: yes, lots, escrow_cash: escrow })
}
