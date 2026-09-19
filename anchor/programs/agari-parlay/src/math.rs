//! The reserve's arithmetic, in integers only (plan §6 "no floats"; mirrored by
//! `packages/core/src/parlay/pricing.ts`, which carries the same golden vectors).
//!
//! A parlay's price is the product of its legs' prices — every leg must come in — with one correction: legs that
//! settle at the *same instant* are not independent, because one print decides them together. Multiplying them as
//! if they were would sell a ticket far too cheaply, so a correlation floor applies whenever two legs share an
//! expiry. `tests::golden` reads the same `pricing.vectors.json` the TypeScript suite does.

pub const BPS: i128 = 10_000;

/// The cost-weighted price of the first `quantity` contracts, rounded up, and how many the book could fill.
///
/// Rounded up because the reserve is the seller: a price rounded down is a discount it never agreed to.
pub fn vwap(levels: &[(i128, i128)], quantity: i128) -> (i128, i128) {
    let mut cost: i128 = 0;
    let mut filled: i128 = 0;
    for &(price, available) in levels {
        if filled >= quantity {
            break;
        }
        let take = available.min(quantity - filled);
        cost += take * price;
        filled += take;
    }
    if filled == 0 {
        return (0, 0);
    }
    (ceil_div(cost, filled), filled)
}

/// Whether any two legs settle at the same instant. O(n²) on a list the params cap in single digits.
pub fn has_shared_instant(expiries_sec: &[i64]) -> bool {
    expiries_sec.iter().enumerate().any(|(i, a)| expiries_sec[i + 1..].iter().any(|b| a == b))
}

/// Π of the leg prices, floored at `correlation_bps` × the cheapest leg when two legs share an instant.
pub fn combine_prob(prices_raw: &[i128], expiries_sec: &[i64], one: i128, correlation_bps: i128) -> i128 {
    let mut combined = one;
    let mut min_price = one;
    for &price in prices_raw {
        combined = (combined * price) / one;
        if price < min_price {
            min_price = price;
        }
    }
    if has_shared_instant(expiries_sec) {
        let floor = (min_price * correlation_bps) / BPS;
        if floor > combined {
            combined = floor;
        }
    }
    combined
}

#[inline]
fn ceil_div(a: i128, b: i128) -> i128 {
    if b == 0 {
        return 0;
    }
    (a + b - 1) / b
}

/// Fair value plus the margin, both rounded up in the reserve's favour.
pub fn floor_stake(max_payout_base: i128, combined_prob_raw: i128, one: i128, margin_bps: i128) -> i128 {
    let fair = ceil_div(max_payout_base * combined_prob_raw, one);
    ceil_div(fair * (BPS + margin_bps), BPS)
}

#[cfg(test)]
mod tests;
