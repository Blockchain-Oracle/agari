//! The Rust arithmetic against the same vectors the TypeScript suite runs, compiled in from one file so the
//! quote a person is shown and the stake the chain charges them cannot drift apart.

use super::*;
use serde_json::Value;

const VECTORS_JSON: &str = include_str!("../../../../../packages/core/src/parlay/pricing.vectors.json");
const ONE: i128 = 1_000_000;

fn big(v: &Value, key: &str) -> i128 {
    v[key].as_str().expect("string amount").parse().expect("integer amount")
}

#[test]
fn golden_vectors_match_the_typescript() {
    let doc: Value = serde_json::from_str(VECTORS_JSON).expect("vectors parse");
    let vectors = doc["vectors"].as_array().expect("vectors array");
    assert!(!vectors.is_empty(), "the vector file is empty");

    for v in vectors {
        let name = v["name"].as_str().unwrap_or("<unnamed>");
        let legs = v["legs"].as_array().expect("legs");
        let prices: Vec<i128> = legs.iter().map(|l| big(l, "priceRaw")).collect();
        let expiries: Vec<i64> = legs.iter().map(|l| l["expirySec"].as_i64().expect("expirySec")).collect();
        let correlation = v["correlationBps"].as_i64().expect("correlationBps") as i128;
        let combined = combine_prob(&prices, &expiries, ONE, correlation);
        assert_eq!(combined, big(&v["expect"], "combinedProbRaw"), "combinedProbRaw for {name}");

        let margin = v["marginBps"].as_i64().expect("marginBps") as i128;
        let stake = floor_stake(big(v, "maxPayout"), combined, ONE, margin);
        assert_eq!(stake, big(&v["expect"], "floorStake"), "floorStake for {name}");
    }
}

/// Legs deciding on one print are not independent. Multiplying them as if they were is the mistake the floor
/// exists to stop, so it is asserted directly rather than trusted to the vectors.
///
/// The floor bites where it matters — on the long shots. Two legs at 0.2 multiply to 0.04, which is a ticket the
/// reserve would sell at twenty-five to one; if one print decides both, the true odds are nearer the single leg's,
/// and the floor prices it at 40% of that instead.
#[test]
fn legs_sharing_an_instant_are_floored_above_the_product() {
    let prices = [200_000i128, 200_000];
    let product = combine_prob(&prices, &[300, 600], ONE, 4_000);
    let correlated = combine_prob(&prices, &[300, 300], ONE, 4_000);
    assert_eq!(product, 40_000, "independent legs simply multiply");
    assert_eq!(correlated, 80_000, "40% of the cheapest leg, which is dearer than the product");
    assert!(correlated > product, "a correlated ticket must never be cheaper than an independent one");
}

/// The floor only ever raises the price. Where the product already sits above it — the short-priced tickets — a
/// shared expiry must change nothing, or the floor would be making a ticket cheaper, which is exactly backwards.
#[test]
fn the_floor_never_lowers_a_price() {
    let prices = [900_000i128, 900_000];
    let product = combine_prob(&prices, &[300, 600], ONE, 4_000);
    let correlated = combine_prob(&prices, &[300, 300], ONE, 4_000);
    assert_eq!(correlated, product, "a floor under the product changes nothing");
}

#[test]
fn vwap_rounds_up_and_reports_what_the_book_could_fill() {
    // Two levels, 100 at 0.50 and 100 at 0.60: 150 contracts average 0.5333…, rounded up.
    let levels = [(500_000i128, 100i128), (600_000, 100)];
    let (price, filled) = vwap(&levels, 150);
    assert_eq!(filled, 150);
    assert_eq!(price, 533_334, "rounded up: the reserve is the seller");
    let (_, short) = vwap(&levels, 500);
    assert_eq!(short, 200, "a thin book fills what it has and says so");
    assert_eq!(vwap(&[], 10), (0, 0));
}

#[test]
fn shared_instants_are_detected_across_the_whole_list() {
    assert!(!has_shared_instant(&[300, 600, 900]));
    assert!(has_shared_instant(&[300, 600, 300]));
    assert!(has_shared_instant(&[900, 900]));
    assert!(!has_shared_instant(&[]));
}
