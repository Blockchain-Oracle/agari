//! Sizing a stake off a Book in raw units (`ticks × tick_base`, `lots × lot_base`, `one = tick_base × PAIR_TICKS`).
//!
//! Every product that turns a stake into an IOC walks the taken side the same way: the leverage reserve at open, the
//! private desk at its mint. It lives here so they run one copy, and `packages/core/src/leverage/sizing.ts` mirrors
//! it line for line on the shared golden vectors (`sizing.vectors.json`, read by `agari-leverage`'s tests).
//!
//! Prices are collateral per whole contract scaled by `one`; a contract pays `one` when its side lands, so a raw
//! quantity is also its payout in base units. The cost of a walk rounds up once, in the seller's favour.

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
