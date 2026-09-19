//! The Rust arithmetic against the same vectors the TypeScript suite runs.
//!
//! `packages/core/src/range/pricing.vectors.json` is read at compile time, so there is exactly one copy of the
//! golden numbers. If someone edits the pricing on either side without the other, this fails rather than letting
//! the quote a person is shown drift from the stake the chain charges them.

use super::*;
use serde_json::Value;

const VECTORS_JSON: &str = include_str!("../../../../../packages/core/src/range/pricing.vectors.json");
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
        let inside = band_prob_e6(
            big(v, "openingPrint"),
            big(v, "lowPrint"),
            big(v, "highPrint"),
            v["centerQE6"].as_i64().expect("centerQE6") as i128,
            v["sigmaE8"].as_i64().expect("sigmaE8") as i128,
            v["tauSec"].as_i64().expect("tauSec"),
        );
        assert_eq!(inside, big(&v["expect"], "insideProbE6"), "insideProbE6 for {name}");

        let is_inside = v["side"].as_str().expect("side") == "inside";
        let prob_raw = side_prob_raw(inside, is_inside, ONE);
        assert_eq!(prob_raw, big(&v["expect"], "probRaw"), "probRaw for {name}");

        let margin = v["marginBps"].as_i64().expect("marginBps") as i128;
        let stake = floor_stake(big(v, "maxPayout"), prob_raw, ONE, margin);
        assert_eq!(stake, big(&v["expect"], "floorStake"), "floorStake for {name}");
    }
}

#[test]
fn the_table_is_symmetric_and_saturates() {
    assert_eq!(cdf_e6(0), 500_000);
    assert_eq!(cdf_e6(10_000) + cdf_e6(-10_000), 1_000_000);
    assert_eq!(cdf_e6(40_000), 1_000_000);
    assert_eq!(cdf_e6(-99_999), 0);
}

#[test]
fn probit_inverts_the_table_within_a_thousandth_of_a_sigma() {
    let mut z = -35_000i128;
    while z <= 35_000 {
        let back = probit_e4(cdf_e6(z));
        assert!((back - z).abs() <= 10, "probit(cdf({z})) = {back}");
        z += 625;
    }
    assert_eq!(probit_e4(500_000), 0);
    assert_eq!(probit_e4(999_999), 40_000);
    assert_eq!(probit_e4(1), -40_000);
}

#[test]
fn root_and_standard_deviation_match_the_reference() {
    assert_eq!(isqrt(2_400_000), 1_549);
    // u128 caps the shift where the TypeScript test used an arbitrary-precision BigInt.
    assert_eq!(isqrt(1u128 << 100), 1u128 << 50);
    assert_eq!(isqrt(u128::MAX), (1u128 << 64) - 1);
    assert_eq!(std_e8(6_200, 240), 96_038);
    assert_eq!(std_e8(6_200, 300), 107_384);
}

/// A print below the open must truncate toward zero exactly as the TypeScript's BigInt division does; a `z`
/// that rounded the other way would widen the band on one side only and systematically misprice `outside`.
#[test]
fn z_truncates_toward_zero_on_both_sides() {
    let p0: i128 = 7_673_523;
    let std = std_e8(6_200, 240);
    assert_eq!(z_of(p0 + 3_000, p0, std), 4_070);
    assert_eq!(z_of(p0 - 3_000, p0, std), -4_070);
}

/// The reserve must never price a round it would lose money on by rounding: the stake it charges is fair value
/// plus margin, each rounded *up*, so a payout one unit larger always costs strictly more.
#[test]
fn the_floor_stake_rounds_in_the_reserves_favour() {
    for payout in [1_000_000i128, 5_000_000, 33_333_333, 100_000_000] {
        for prob in [39i128, 20_000, 315_946, 684_054, 969_999] {
            let stake = floor_stake(payout, prob, ONE, 1_200);
            assert!(floor_stake(payout + 1, prob, ONE, 1_200) >= stake, "monotonic at payout {payout}, prob {prob}");
            let fair = (payout * prob) / ONE;
            assert!(stake >= fair, "stake {stake} below fair {fair}");
        }
    }
}

/// Degenerate inputs must return rather than divide by zero: a Window with no opening print yet, and a lane
/// whose time left has run to zero, both reach this code before the instruction's own guards in some orders.
#[test]
fn degenerate_inputs_do_not_panic() {
    assert_eq!(z_of(100, 0, 1_000), 0);
    assert_eq!(z_of(100, 100, 0), 0);
    assert_eq!(std_e8(6_200, 0), 0);
    assert_eq!(isqrt(0), 0);
}
