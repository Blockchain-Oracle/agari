//! The boost's arithmetic, in integers only (mirrored line for line by `packages/core/src/leverage/sizing.ts`,
//! which carries the same golden vectors).
//!
//! Prices are collateral per whole contract, scaled by `one`; a contract pays `one` when its side lands, so a raw
//! quantity is also its payout in base units. Every rounding is in the reserve's favour: the owner's stake rounds
//! up, the reserve's front rounds down. `tests::golden` reads the same `sizing.vectors.json` the TypeScript does.

pub const BPS: u128 = 10_000;

/// One resting level in the venue's own terms: the YES price, whatever kind rests there, and what rests.
pub type YesLevel = (u128, u128);

pub fn ceil_div(a: u128, b: u128) -> u128 {
    if a == 0 || b == 0 {
        return 0;
    }
    (a - 1) / b + 1
}

/// One level's price in the taken side's own terms: a NO level is the YES level inverted.
pub fn side_price(yes_price_raw: u128, invert: bool, one: u128) -> u128 {
    if invert {
        one.saturating_sub(yes_price_raw)
    } else {
        yes_price_raw
    }
}

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq)]
pub struct Walk {
    /// Collateral for what filled, rounded up once.
    pub cost_base: u128,
    pub filled_raw: u128,
    /// The last level touched, in the venue's YES terms: the IOC's limit.
    pub limit_yes_raw: u128,
}

/// Takes the first `quantity_raw` contracts resting on `levels`, in the order they rest.
pub fn walk_quantity(levels: &[YesLevel], invert: bool, one: u128, quantity_raw: u128) -> Walk {
    let mut weighted: u128 = 0;
    let mut walk = Walk::default();
    for &(price, quantity) in levels {
        if walk.filled_raw >= quantity_raw {
            break;
        }
        let take = quantity.min(quantity_raw - walk.filled_raw);
        if take == 0 {
            continue;
        }
        weighted = weighted.saturating_add(take.saturating_mul(side_price(price, invert, one)));
        walk.filled_raw += take;
        walk.limit_yes_raw = price;
    }
    walk.cost_base = ceil_div(weighted, one);
    walk
}

/// The most contracts `budget_base` buys off `levels`, floored to `lot_raw`: the size a stake affords.
pub fn walk_budget(levels: &[YesLevel], invert: bool, one: u128, budget_base: u128, lot_raw: u128) -> u128 {
    let mut weighted: u128 = 0;
    let mut quantity_raw: u128 = 0;
    let cap = budget_base.saturating_mul(one);
    for &(level_price, available) in levels {
        let price = side_price(level_price, invert, one);
        if price == 0 {
            continue;
        }
        let take = ((cap - weighted) / price).min(available);
        weighted += take * price;
        quantity_raw += take;
        if take < available {
            break;
        }
    }
    if lot_raw > 1 {
        (quantity_raw / lot_raw) * lot_raw
    } else {
        quantity_raw
    }
}

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
