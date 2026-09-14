//! Rust walks against the shared vectors (anchor/tests/vectors/book.vectors.json), which the TS mirror also passes.

use super::*;
use serde_json::Value;

const VECTORS: &str = include_str!("../../../../tests/vectors/book.vectors.json");

struct TestLevel(u32);
impl WalkLevel for TestLevel {
    fn head(&self) -> u32 {
        self.0
    }
}

#[derive(Clone)]
struct TestNode {
    lots: u64,
    expire_ts: i64,
    placed_slot: u64,
    live: bool,
    next: u32,
}
impl WalkNode for TestNode {
    fn lots(&self) -> u64 {
        self.lots
    }
    fn expire_ts(&self) -> i64 {
        self.expire_ts
    }
    fn placed_slot(&self) -> u64 {
        self.placed_slot
    }
    fn is_live(&self) -> bool {
        self.live
    }
    fn next(&self) -> u32 {
        self.next
    }
}

struct Built {
    bits: [u64; 16],
    levels: Vec<TestLevel>,
    nodes: Vec<TestNode>,
}

fn num<T: core::str::FromStr>(v: &Value) -> T
where
    T::Err: core::fmt::Debug,
{
    match v {
        Value::String(s) => s.parse().unwrap(),
        other => other.to_string().parse().unwrap(),
    }
}

/// The vectors' layout rule: nodes in reverse list order, FIFO within a price = list order, bit per occupied price.
fn build(orders: &[Value]) -> Built {
    let count = orders.len();
    let placeholder = TestNode { lots: 0, expire_ts: 0, placed_slot: 0, live: false, next: 0 };
    let mut nodes = vec![placeholder; count];
    let mut heads = [0u32; 1000];
    let mut tails = [0u32; 1000];
    let mut bits = [0u64; 16];
    for (k, o) in orders.iter().enumerate() {
        let index = count - 1 - k;
        let price: usize = num(&o["price"]);
        let r = (index + 1) as u32;
        nodes[index] = TestNode { lots: num(&o["lots"]), expire_ts: num(&o["expireTs"]), placed_slot: num(&o["placedSlot"]), live: o["live"].as_bool().unwrap(), next: 0 };
        if heads[price] == 0 {
            heads[price] = r;
        } else {
            nodes[(tails[price] - 1) as usize].next = r;
        }
        tails[price] = r;
        bits[price / 64] |= 1 << (price % 64);
    }
    Built { bits, levels: heads.iter().map(|h| TestLevel(*h)).collect(), nodes }
}

fn wire(levels: &[Level]) -> Value {
    Value::Array(levels.iter().map(|(p, q)| serde_json::json!([p, q.to_string()])).collect())
}

fn kind(s: &str) -> TakerKind {
    match s {
        "BUY_YES" => TakerKind::BuyYes,
        "SELL_YES" => TakerKind::SellYes,
        "BUY_NO" => TakerKind::BuyNo,
        _ => TakerKind::SellNo,
    }
}

#[test]
fn walks_match_every_shared_vector() {
    let doc: Value = serde_json::from_str(VECTORS).unwrap();
    let cases = doc["cases"].as_array().unwrap();
    assert!(cases.len() >= 49);
    for c in cases {
        let name = c["name"].as_str().unwrap();
        let (b, a) = (build(c["bids"].as_array().unwrap()), build(c["asks"].as_array().unwrap()));
        let bids = BookSide { bits: &b.bits, levels: &b.levels, nodes: &b.nodes };
        let asks = BookSide { bits: &a.bits, levels: &a.levels, nodes: &a.nodes };
        let f = &c["filter"];
        let filter = NodeFilter { now: num(&f["now"]), slot: num(&f["slot"]), rested_only: f["restedOnly"].as_bool().unwrap(), min_rest_slots: num(&f["minRestSlots"]) };
        let n: usize = num(&c["n"]);
        let e = &c["expect"];

        assert_eq!(wire(&levels(&bids, Side::Bid, n, &filter)), e["bidLevels"], "{name}: bids");
        assert_eq!(wire(&levels(&asks, Side::Ask, n, &filter)), e["askLevels"], "{name}: asks");
        let (tb, ta) = top_of_book(&bids, &asks, &filter);
        let one = |l: Option<Level>| l.map_or(Value::Null, |l| wire(&[l])[0].clone());
        assert_eq!(serde_json::json!({ "bid": one(tb), "ask": one(ta) }), e["top"], "{name}: top");
        for k in ["BUY_YES", "SELL_YES", "BUY_NO", "SELL_NO"] {
            assert_eq!(wire(&outcome_levels(kind(k), &bids, &asks, n, &filter)), e["outcome"][k], "{name}: outcome {k}");
        }
        for v in e["vwap"].as_array().unwrap() {
            let lv = outcome_levels(kind(v["kind"].as_str().unwrap()), &bids, &asks, 32, &filter);
            let (vwap, filled) = vwap_over_depth(&lv, num(&v["lots"]));
            assert_eq!((vwap.to_string(), filled.to_string()), (num::<String>(&v["vwapTicks"]), num::<String>(&v["filled"])), "{name}: vwap");
        }
        for x in e["exit"].as_array().unwrap() {
            let lv = outcome_levels(kind(x["kind"].as_str().unwrap()), &bids, &asks, 32, &filter);
            let (proceeds, filled) = exit_walk(&lv, num(&x["lots"]));
            assert_eq!((proceeds.to_string(), filled.to_string()), (num::<String>(&x["proceeds"]), num::<String>(&x["filled"])), "{name}: exit");
        }
        for q in e["quotes"].as_array().unwrap() {
            let side_str = q["side"].as_str().unwrap();
            let side = if side_str == "BUY_YES" { BuySide::Yes } else { BuySide::No };
            let lv = outcome_levels(kind(side_str), &bids, &asks, 32, &filter);
            let got = quote_stake(&lv, side, num(&q["stake"]), num(&q["cu"]), num(&q["minLots"]), num(&q["slippageBps"]), num(&q["minTicks"]));
            let got = got.map_or(Value::Null, |r| {
                serde_json::json!({ "limitTicks": r.limit_ticks, "yesPriceTicks": r.yes_price_ticks, "lots": r.lots.to_string(), "escrowCash": r.escrow_cash.to_string() })
            });
            assert_eq!(got, q["result"], "{name}: quote {side_str}");
        }
    }
}

#[test]
fn a_cyclic_or_corrupt_level_never_loops() {
    let nodes = vec![
        TestNode { lots: 5, expire_ts: 100, placed_slot: 0, live: true, next: 2 },
        TestNode { lots: 7, expire_ts: 100, placed_slot: 0, live: true, next: 1 },
    ];
    let mut level_heads: Vec<TestLevel> = (0..1000).map(|_| TestLevel(0)).collect();
    level_heads[500] = TestLevel(1);
    level_heads[400] = TestLevel(99); // out of range ref
    let mut bits = [0u64; 16];
    bits[500 / 64] |= 1 << (500 % 64);
    bits[400 / 64] |= 1 << (400 % 64);
    let side = BookSide { bits: &bits, levels: &level_heads, nodes: &nodes };
    let filter = NodeFilter { now: 0, slot: 0, rested_only: false, min_rest_slots: 0 };
    // Two steps (nodes.len()) then stop: 5 + 7, never an infinite walk; the corrupt 400 level reads as empty.
    assert_eq!(levels(&side, Side::Bid, 32, &filter), vec![(500, 12)]);
}
