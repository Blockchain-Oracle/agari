//! The boost's arithmetic, in integers only (mirrored line for line by `packages/core/src/leverage/sizing.ts`,
//! which carries the same golden vectors).
//!
//! Prices are collateral per whole contract, scaled by `one`; a contract pays `one` when its side lands, so a raw
//! quantity is also its payout in base units. Every rounding is in the reserve's favour: the owner's stake rounds
//! up, the reserve's front rounds down. `tests::golden` reads the same `sizing.vectors.json` the TypeScript does.

use agari_common::grid::{PAYOUT_DENOMINATOR, PAYOUT_VOID};

pub const BPS: u128 = 10_000;

pub use agari_common::stake_walk::{ceil_div, side_price, walk_budget, walk_quantity, Walk, YesLevel};

/// `leverage − (leverage − 1) × premium`, scaled BPS²: the notional a whole unit of stake deploys.
pub fn deploy_scale(leverage_bps: u32, premium_bps: u16) -> u128 {
    let lev = u128::from(leverage_bps);
    lev * BPS - lev.saturating_sub(BPS) * u128::from(premium_bps)
}

/// The notional `stake` deploys at `leverage_bps`: the stake, plus the front, less the premium.
pub fn budget_for(stake_base: u128, leverage_bps: u32, premium_bps: u16) -> u128 {
    stake_base * deploy_scale(leverage_bps, premium_bps) / (BPS * BPS)
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Terms {
    pub stake_base: u128,
    pub fronted_base: u128,
    pub premium_base: u128,
}

/// The terms behind a fill that cost `cost_base`: the owner's cash, the reserve's front and its premium, holding
/// `stake + fronted − premium == cost` exactly.
pub fn terms(cost_base: u128, leverage_bps: u32, premium_bps: u16) -> Terms {
    let nominal = ceil_div(cost_base * BPS * BPS, deploy_scale(leverage_bps, premium_bps));
    let fronted_base = nominal * u128::from(leverage_bps).saturating_sub(BPS) / BPS;
    let premium_base = fronted_base * u128::from(premium_bps) / BPS;
    Terms { stake_base: cost_base + premium_base - fronted_base, fronted_base, premium_base }
}

/// What the owner collects if the side lands: the contracts pay one each, the reserve is repaid first.
pub fn win_if_right(quantity_raw: u128, fronted_base: u128) -> u128 {
    quantity_raw.saturating_sub(fronted_base)
}

/// The mark at which anyone may knock the position out: `fronted × maintenance`.
pub fn knockout_line(fronted_base: u128, maintenance_bps: u16) -> u128 {
    fronted_base * u128::from(maintenance_bps) / BPS
}

/// True once the mark has fallen to the maintenance line: the reserve's claim is at risk.
pub fn is_knockable(mark_base: u128, fronted_base: u128, maintenance_bps: u16) -> bool {
    fronted_base != 0 && mark_base * BPS < fronted_base * u128::from(maintenance_bps)
}

/// True when a voided Window would still repay the whole front.
///
/// The venue pays every contract `PAYOUT_VOID / PAYOUT_DENOMINATOR` of its face when it voids a Window, which it
/// does when its own prints fail. That is a failure of the venue, not a move of the market, so the providers must
/// not be the ones who pay for it: a front larger than what a void returns is refused at open.
pub fn void_covers(quantity_raw: u128, fronted_base: u128) -> bool {
    fronted_base * u128::from(PAYOUT_DENOMINATOR) <= quantity_raw * u128::from(PAYOUT_VOID)
}

/// What `proceeds` repay of the front, and what is left for the owner.
pub fn split(proceeds_base: u128, fronted_base: u128) -> (u128, u128) {
    let reclaimed = proceeds_base.min(fronted_base);
    (reclaimed, proceeds_base - reclaimed)
}

/// What the book would pay for `quantity_raw` right now: the exit walk, a unit under its ceiling-rounded cost, so the
/// mark never rounds in the owner's favour.
pub fn mark_over(exit_levels: &[YesLevel], invert: bool, one: u128, quantity_raw: u128) -> (u128, Walk) {
    let walk = walk_quantity(exit_levels, invert, one, quantity_raw);
    (walk.cost_base.saturating_sub(1), walk)
}

#[cfg(test)]
mod tests;
