//! The 10 caps vectors (vault.md §4) replayed on-chain, as `CapsVectors.t.sol` does over Masayume's contract: each
//! vector in fresh state with 5,000 tUSDC deposited, a STRATEGY grant, and the maker's book filling YES at 0.60 and
//! NO at 0.40. `packages/core/src/vault/caps.test.ts` asserts the same rows against `simulateCaps`.

use agari_events_tests::vault::{event, VaultWorld, ONE, STRATEGY};
use agari_events_tests::vault_ix::{buy, GrantArgs};
use agari_vault::events::Executed;
use agari_vault::instructions::CapsArgs;
use serde_json::Value;
use solana_signer::Signer;

/// Masayume's raw units: `ONE = 1e6`; lot = tick = 1,000 base units, so raw / 1,000 is lots or ticks.
const RAW_PER_UNIT: u64 = 1_000;
const LIQUIDITY_LOTS: u64 = 1_000_000;

fn raw(v: &Value) -> u64 {
    match v {
        Value::String(s) => s.parse().expect("integer string"),
        other => other.as_u64().expect("integer"),
    }
}

/// The error a vector names, as the code the chain returns (vault.md §6; the engine's 6110 for an empty IOC).
fn code(name: &str) -> u32 {
    match name {
        "Insufficient" => 7001,
        "GrantIsRevoked" => 7103,
        "GrantExpired" => 7104,
        "OverStakeCap" => 7108,
        "OverDailyCap" => 7109,
        "OverPositionCap" => 7110,
        "OverPriceCap" => 7111,
        "ImmediateOrCancelNoFill" => 6110,
        other => panic!("unknown error name in vector: {other}"),
    }
}

/// `(outcome, price_ticks, lots)` of a vector order.
fn order(v: &Value) -> (u8, u16, u64) {
    let price = u16::try_from(raw(&v["priceRaw"]) / RAW_PER_UNIT).unwrap();
    (raw(&v["outcomeIdx"]) as u8, price, raw(&v["quantityRaw"]) / RAW_PER_UNIT)
}

fn run(v: &Value) {
    let name = v["name"].as_str().unwrap();
    let mut vw = VaultWorld::new();
    let owner = vw.owner(5_000 * ONE);
    let actor = vw.key();
    let win = vw.win;

    let c = &v["caps"];
    let caps = CapsArgs {
        max_stake_per_trade: raw(&c["maxStakePerTrade"]),
        max_daily_spend: raw(&c["maxDailySpend"]),
        max_open_positions: u32::try_from(raw(&c["maxOpenPositions"])).unwrap(),
        max_price_ticks: u16::try_from(raw(&c["maxPriceRaw"]) / RAW_PER_UNIT).unwrap(),
    };
    let expired = v["expired"].as_bool().unwrap();
    let now = vw.h().now();
    let grant_id = vw.config().next_grant_id;
    let terms = GrantArgs { grant_id, kind: STRATEGY, actor: actor.pubkey(), caps, expires_at_sec: now + if expired { 1 } else { 86_400 }, budget: raw(&v["budget"]) };
    let grant = vw.h().vault_grant_ix(&owner.pubkey(), terms, None);
    vw.h().ok(&[grant], &[&owner.key]);
    if expired {
        vw.h().warp_to(now + 2);
    }

    if !v["prior"].is_null() {
        let (outcome, price, lots) = order(&v["prior"]);
        vw.liquidity(outcome, LIQUIDITY_LOTS);
        let ix = vw.h().vault_place_for_ix(&actor.pubkey(), &owner.pubkey(), grant_id, &win, buy(outcome, price, lots));
        vw.h().vault_send(&[ix], &[&actor]).unwrap_or_else(|e| panic!("{name}: prior order refused with {e}"));
    }

    let (outcome, price, lots) = order(&v["order"]);
    vw.liquidity(outcome, LIQUIDITY_LOTS);
    let ix = vw.h().vault_place_for_ix(&actor.pubkey(), &owner.pubkey(), grant_id, &win, buy(outcome, price, lots));
    let budget_before = vw.grant(grant_id).budget;
    let result = vw.h().vault_send(&[ix], &[&actor]);
    let expect = &v["expect"];
    if expect["ok"].as_bool().unwrap() {
        let (_, events) = result.unwrap_or_else(|e| panic!("{name}: expected a fill, got {e}"));
        let executed: Executed = event(&events).expect("Executed event");
        assert_eq!(executed.cash_delta, raw(&expect["spendBase"]), "{name}: spendBase");
        assert_eq!(budget_before - vw.grant(grant_id).budget, executed.cash_delta, "{name}: the budget paid the actual charge");
    } else {
        let error = expect["error"].as_str().unwrap();
        assert_eq!(result.err(), Some(code(error)), "{name}: expected {error}");
        assert_eq!(vw.grant(grant_id).budget, budget_before, "{name}: a refusal reverts everything");
    }
}

#[test]
fn every_caps_vector_matches_the_chain() {
    let path = format!("{}/../../packages/core/src/vault/caps.vectors.json", env!("CARGO_MANIFEST_DIR"));
    let json: Value = serde_json::from_str(&std::fs::read_to_string(path).expect("caps vectors")).unwrap();
    let vectors = json["vectors"].as_array().unwrap();
    assert_eq!((json["count"].as_u64(), vectors.len()), (Some(10), 10));
    for v in vectors {
        run(v);
    }
}
