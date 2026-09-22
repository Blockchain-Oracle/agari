//! The money guards (desk.md §4.5, §5) as pure functions over the zero-copy state, so buy and sell share one copy of
//! the rules and `packages/core/src/desk/gate.ts` can mirror them integer for integer (`gate.vectors.json`).
//! Every refusal reverts the whole transaction.

use anchor_lang::prelude::*;

use crate::constants::{BAND_KEEP_DEN, BAND_KEEP_NUM, BPS, CAP_WINDOW_SEC, E11, E12, VALUE_SCALE};
use crate::errors::DeskError;
use crate::state::Desk;

fn to_u64(v: u128) -> Result<u64> {
    u64::try_from(v).map_err(|_| DeskError::MathOverflow.into())
}

/// The least raw tokens `usdc_in` must bring back: `usdc_in × 10^23 × 92 / (multiplier × price × 100)`, that is
/// 8 % inside the attested price. `92 / 100` is `9200 / 10000` reduced, so the u128 headroom reaches $37 M an action.
pub fn buy_floor(usdc_in: u64, multiplier_e12: u64, token_price_e8: u64) -> Result<u64> {
    let numerator = u128::from(usdc_in).checked_mul(VALUE_SCALE).and_then(|v| v.checked_mul(BAND_KEEP_NUM)).ok_or(DeskError::MathOverflow)?;
    let denominator = u128::from(multiplier_e12).checked_mul(u128::from(token_price_e8)).and_then(|v| v.checked_mul(BAND_KEEP_DEN)).ok_or(DeskError::MathOverflow)?;
    require!(denominator > 0, DeskError::InvalidReference);
    to_u64(numerator / denominator)
}

/// What `token_in` raw tokens are worth at the attested price, in USDC E6, in this exact order of operations:
/// `((raw × price) / 10^11) × multiplier / 10^12`.
pub fn sell_oracle_value(token_in: u64, multiplier_e12: u64, token_price_e8: u64) -> Result<u64> {
    let priced = u128::from(token_in).checked_mul(u128::from(token_price_e8)).ok_or(DeskError::MathOverflow)? / E11;
    let scaled = priced.checked_mul(u128::from(multiplier_e12)).ok_or(DeskError::MathOverflow)? / E12;
    to_u64(scaled)
}

/// 8 % inside the attested value.
pub fn sell_floor(oracle_value_e6: u64) -> Result<u64> {
    to_u64(u128::from(oracle_value_e6).checked_mul(BAND_KEEP_NUM).ok_or(DeskError::MathOverflow)? / BAND_KEEP_DEN)
}

/// `token × 10000 ≤ reference × (10000 + max)`: at most `max_premium_bps` above the reference, inclusive. A reference
/// of zero never passes: a buy without a reference is refused, never waved through.
pub fn premium_ok(token_price_e8: u64, reference_e8: u64, max_premium_bps: u16) -> bool {
    if reference_e8 == 0 {
        return false;
    }
    // A u64 times a few tens of thousands is far inside u128; checked anyway, and an overflow refuses.
    let token = u128::from(token_price_e8).checked_mul(BPS);
    let ceiling = u128::from(reference_e8).checked_mul(BPS + u128::from(max_premium_bps));
    matches!((token, ceiling), (Some(t), Some(c)) if t <= c)
}

/// The floor the operator's own minimum is raised to: the larger of the two.
pub fn effective_min_out(requested: u64, floor: u64) -> u64 {
    requested.max(floor)
}

/// What a sell counts against the caps: the larger of what came back and the attested value, so a route arranged
/// to return little USDC cannot make the cap weakest exactly when it matters.
pub fn counted(usdc_out: u64, oracle_value_e6: u64) -> u64 {
    usdc_out.max(oracle_value_e6)
}

/// The caps (desk.md §4.5 step 9): `amount ≤ per_action_cap`, a fixed 24 h window that restarts when the clock
/// passes `window_start + 1 day`, then `spent + amount ≤ daily_cap`. Known and accepted: spending at the end of one
/// window and the start of the next allows up to twice the cap inside 24 hours.
pub fn spend(desk: &mut Desk, amount: u64, now: i64) -> Result<()> {
    require!(amount <= desk.per_action_cap, DeskError::OverPerActionCap);
    if now >= desk.window_start_sec.saturating_add(CAP_WINDOW_SEC) {
        desk.window_start_sec = now;
        desk.spent_in_window = 0;
    }
    let total = desk.spent_in_window.checked_add(amount).ok_or(DeskError::MathOverflow)?;
    require!(total <= desk.daily_cap, DeskError::OverDailyCap);
    desk.spent_in_window = total;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::state::DeskToken;
    use serde_json::Value;

    fn desk(per_action_cap: u64, daily_cap: u64) -> Desk {
        Desk { owner: Pubkey::default(), operator: Pubkey::default(), head: [0; 32], seq: 0, per_action_cap, daily_cap, spent_in_window: 0, window_start_sec: 0, tokens: [DeskToken::default(); 8], max_premium_bps: 0, mode: 2, paused: 0, require_pyth_index: 0, bump: 0, token_count: 0, _pad0: 0, _reserved: [0; 64] }
    }

    fn u(v: &Value) -> u64 {
        v.as_str().expect("decimal string").parse().expect("u64")
    }

    /// Every row of `gate.vectors.json`: the floor, the sell value, what is counted, the premium, the caps and the band.
    #[test]
    fn gate_vectors() {
        let text = std::fs::read_to_string(format!("{}/../../../packages/core/src/desk/gate.vectors.json", env!("CARGO_MANIFEST_DIR"))).unwrap();
        let file: Value = serde_json::from_str(&text).unwrap();
        let vectors = file["vectors"].as_array().unwrap();
        assert_eq!(vectors.len(), file["count"].as_u64().unwrap() as usize);
        for v in vectors {
            let name = v["name"].as_str().unwrap();
            let (amount_in, quote_out, price, multiplier) = (u(&v["amountIn"]), u(&v["quoteOut"]), u(&v["tokenPriceE8"]), u(&v["multiplierE12"]));
            let expect = &v["expect"];
            if amount_in == 0 {
                assert_eq!(expect["result"], "deny", "{name}");
                continue;
            }
            let is_buy = v["side"] == "buy";
            let (oracle_value, floor) = if is_buy {
                (0, buy_floor(amount_in, multiplier, price).unwrap())
            } else {
                let value = sell_oracle_value(amount_in, multiplier, price).unwrap();
                (value, sell_floor(value).unwrap())
            };
            assert_eq!(oracle_value, u(&expect["oracleValueE6"]), "{name}: oracle value");
            assert_eq!(floor, u(&expect["oracleFloor"]), "{name}: floor");
            let counted_e6 = if is_buy { amount_in } else { counted(quote_out, oracle_value) };
            assert_eq!(counted_e6, u(&expect["countedE6"]), "{name}: counted");
            let slippage = v["slippageBps"].as_u64().unwrap() as u128;
            let our_floor = (u128::from(quote_out) * (BPS - slippage) / BPS) as u64;
            assert_eq!(effective_min_out(our_floor, floor), u(&expect["minOut"]), "{name}: min out");
            assert_eq!(quote_out < floor, expect["beyondBand"].as_bool().unwrap(), "{name}: band");
            if is_buy {
                let reference = v["referenceE8"].as_str().map(|s| s.parse::<u64>().unwrap()).unwrap_or(0);
                assert_eq!(premium_ok(price, reference, v["maxPremiumBps"].as_u64().unwrap() as u16), expect["premiumOk"].as_bool().unwrap(), "{name}: premium");
            }
            // The caps the gate applied: the smaller of the chain's and the mandate's, and what is left today.
            let chain_per_action = u(&v["desk"]["perActionCapE6"]);
            let chain_left = u(&v["desk"]["remainingDailyCapE6"]);
            let (per_action, left_today) = match v["mandate"].as_object() {
                Some(m) => (chain_per_action.min(u(&m["perActionCapE6"])), chain_left.min(u(&m["dailyCapE6"]) - u(&m["spentTodayE6"]))),
                None => (chain_per_action, chain_left),
            };
            let over_per_action = spend(&mut desk(per_action, u64::MAX), counted_e6, 0).is_err();
            let over_daily = spend(&mut desk(u64::MAX, left_today), counted_e6, 0).is_err();
            assert_eq!(over_per_action, expect["overPerAction"].as_bool().unwrap(), "{name}: per action");
            assert_eq!(over_daily, expect["overDaily"].as_bool().unwrap(), "{name}: daily");
        }
    }

    #[test]
    fn the_window_is_fixed_and_restarts_after_a_day() {
        let mut d = desk(50, 150);
        spend(&mut d, 50, 1_000).unwrap();
        spend(&mut d, 50, 2_000).unwrap();
        spend(&mut d, 50, 3_000).unwrap();
        assert_eq!(spend(&mut d, 1, 4_000).unwrap_err(), DeskError::OverDailyCap.into());
        assert_eq!(spend(&mut d, 51, 4_000).unwrap_err(), DeskError::OverPerActionCap.into());
        spend(&mut d, 50, 1_000 + CAP_WINDOW_SEC).unwrap();
        assert_eq!((d.window_start_sec, d.spent_in_window), (1_000 + CAP_WINDOW_SEC, 50));
        assert_eq!(d.remaining_daily_cap(1_000 + CAP_WINDOW_SEC), 100);
    }

    #[test]
    fn overflow_is_an_error_not_a_wrap() {
        assert_eq!(buy_floor(u64::MAX, u64::MAX, u64::MAX).unwrap_err(), DeskError::MathOverflow.into());
        assert_eq!(buy_floor(1, 0, 1).unwrap_err(), DeskError::InvalidReference.into());
        assert!(sell_oracle_value(u64::MAX, u64::MAX, u64::MAX).is_err());
    }
}
