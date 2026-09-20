//! The Rust arithmetic against the same vectors the TypeScript suite runs, compiled in from one file so the boost a
//! person is quoted and the terms the chain books cannot drift apart.

use super::*;
use serde_json::Value;

const VECTORS_JSON: &str = include_str!("../../../../../packages/core/src/leverage/sizing.vectors.json");
const ONE: u128 = 1_000_000;

fn big(v: &Value, key: &str) -> u128 {
    v[key].as_str().unwrap_or_else(|| panic!("string amount {key}")).parse().expect("integer amount")
}

#[test]
fn golden_vectors_match_the_typescript() {
    let doc: Value = serde_json::from_str(VECTORS_JSON).expect("vectors parse");
    let vectors = doc["vectors"].as_array().expect("vectors array");
    assert_eq!(vectors.len() as u64, doc["count"].as_u64().expect("count"), "the file's own count");

    for v in vectors {
        let name = v["name"].as_str().unwrap_or("<unnamed>");
        let levels: Vec<YesLevel> = v["levels"].as_array().expect("levels").iter().map(|l| (big(l, "price"), big(l, "quantity"))).collect();
        let invert = v["invert"].as_bool().expect("invert");
        let leverage = v["leverageBps"].as_u64().expect("leverageBps") as u32;
        let premium = v["premiumBps"].as_u64().expect("premiumBps") as u16;
        let want = &v["expect"];

        let budget = budget_for(big(v, "stake"), leverage, premium);
        assert_eq!(budget, big(want, "budget"), "budget for {name}");
        let quantity = walk_budget(&levels, invert, ONE, budget, big(v, "lot"));
        assert_eq!(quantity, big(want, "quantityRaw"), "quantityRaw for {name}");

        let walk = walk_quantity(&levels, invert, ONE, quantity);
        assert_eq!(walk.cost_base, big(want, "costRaw"), "costRaw for {name}");
        assert_eq!(walk.filled_raw, big(want, "filledRaw"), "filledRaw for {name}");
        assert_eq!(walk.limit_yes_raw, big(want, "limitYesRaw"), "limitYesRaw for {name}");

        let t = terms(walk.cost_base, leverage, premium);
        assert_eq!((t.stake_base, t.fronted_base, t.premium_base), (big(want, "stake"), big(want, "fronted"), big(want, "premium")), "terms for {name}");
        // The identity the reserve's books rest on: nothing is created or lost between the three parties.
        assert_eq!(t.stake_base + t.fronted_base - t.premium_base, walk.cost_base, "stake + fronted − premium == cost for {name}");
        assert_eq!(win_if_right(quantity, t.fronted_base), big(want, "winIfRight"), "winIfRight for {name}");
        // A stake-first boost never charges more than the stake it was given.
        assert!(t.stake_base <= big(v, "stake"), "charged {} over the stake for {name}", t.stake_base);
    }
}

#[test]
fn the_mark_sits_a_unit_under_the_exit_walk_and_never_over_it() {
    let bids = [(580_000, 10_000_000), (570_000, 50_000_000)];
    let (mark, walk) = mark_over(&bids, false, ONE, 20_000_000);
    // 10 at 0.58 + 10 at 0.57 = 11.5, a unit under.
    assert_eq!((walk.cost_base, walk.filled_raw, walk.limit_yes_raw), (11_500_000, 20_000_000, 570_000));
    assert_eq!(mark, 11_499_999);
    assert_eq!(mark_over(&[], false, ONE, 20_000_000).0, 0);
    // DOWN exits into the asks, inverted: selling NO at 1 − 0.62.
    assert_eq!(mark_over(&[(620_000, 100_000_000)], true, ONE, 10_000_000).1.cost_base, 3_800_000);
}

#[test]
fn a_position_is_knockable_only_under_its_line() {
    // Fronted 10 at 110% maintenance: the line is 11.
    assert_eq!(knockout_line(10_000_000, 11_000), 11_000_000);
    assert!(!is_knockable(11_000_000, 10_000_000, 11_000));
    assert!(is_knockable(10_999_999, 10_000_000, 11_000));
    // Nothing fronted, nothing to protect.
    assert!(!is_knockable(0, 0, 11_000));
}

#[test]
fn the_reserve_is_repaid_first_and_the_owner_gets_the_rest() {
    assert_eq!(split(15_000_000, 10_000_000), (10_000_000, 5_000_000));
    assert_eq!(split(10_000_000, 10_000_000), (10_000_000, 0));
    // Under water: everything goes to the reserve and it still takes a loss.
    assert_eq!(split(7_000_000, 10_000_000), (7_000_000, 0));
}

#[test]
fn degenerate_inputs_do_not_panic() {
    assert_eq!(walk_quantity(&[], false, ONE, 1).filled_raw, 0);
    assert_eq!(walk_budget(&[(0, 5)], false, ONE, 10, 1), 0);
    assert_eq!(walk_budget(&[(1_000_000, 5)], true, ONE, 10, 1), 0);
    assert_eq!(ceil_div(0, 0), 0);
    assert_eq!(deploy_scale(10_000, 800), 100_000_000);
    assert_eq!(terms(0, 20_000, 800), Terms::default());
}
