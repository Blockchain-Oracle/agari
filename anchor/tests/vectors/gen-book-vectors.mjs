// Generates book.vectors.json: hand-checked cases (expectations written here by hand and asserted against the TS
// mirror before writing) plus seeded random books (expectations from the TS mirror). `agari-common::book_walk`
// tests read the same file and must match byte for byte. Run: `node anchor/tests/vectors/gen-book-vectors.mjs`.

import { writeFileSync } from "node:fs";
import { bookLevels, exitWalk, outcomeLevels, quoteStake, topOfBook, vwapOverDepth } from "../../../packages/core/src/market/book-math.ts";

const NOW = 1_789_156_800n;
const SLOT = 400_000_000n;
const KINDS = ["BUY_YES", "SELL_YES", "BUY_NO", "SELL_NO"];

/** Nodes in REVERSE list order; FIFO within a price is list order; the bit is set for every price with a node. */
export function buildSide(orders) {
  const nodes = new Array(orders.length);
  const heads = new Array(1000).fill(0);
  const tails = new Array(1000).fill(0);
  const bits = new Array(16).fill(0n);
  orders.forEach((o, k) => {
    const index = orders.length - 1 - k;
    nodes[index] = { lots: BigInt(o.lots), expireTs: BigInt(o.expireTs), placedSlot: BigInt(o.placedSlot), live: o.live, next: 0 };
    if (heads[o.price] === 0) heads[o.price] = index + 1;
    else nodes[tails[o.price] - 1].next = index + 1;
    tails[o.price] = index + 1;
    bits[Math.floor(o.price / 64)] |= 1n << BigInt(o.price % 64);
  });
  return { bits, heads, nodes };
}

const order = (price, lots, over = {}) => ({ price, lots: String(lots), expireTs: String(NOW + 60n), placedSlot: String(SLOT - 100n), live: true, ...over });
const filter = (over = {}) => ({ now: String(NOW), slot: String(SLOT), restedOnly: false, minRestSlots: "50", ...over });
const lv = (levels) => levels.map(([p, q]) => [p, String(q)]);
const big = (v) => (typeof v === "bigint" ? String(v) : v);

function expectations(c) {
  const bids = buildSide(c.bids);
  const asks = buildSide(c.asks);
  const f = { now: BigInt(c.filter.now), slot: BigInt(c.filter.slot), restedOnly: c.filter.restedOnly, minRestSlots: BigInt(c.filter.minRestSlots) };
  const top = topOfBook(bids, asks, f);
  const outcome = Object.fromEntries(KINDS.map((k) => [k, lv(outcomeLevels(k, bids, asks, c.n, f))]));
  const vwap = c.walkLots.flatMap((lots) => ["BUY_YES", "BUY_NO"].map((kind) => {
    const r = vwapOverDepth(outcomeLevels(kind, bids, asks, 32, f), BigInt(lots));
    return { kind, lots: String(lots), vwapTicks: String(r.vwapTicks), filled: String(r.filled) };
  }));
  const exit = c.walkLots.flatMap((lots) => ["SELL_YES", "SELL_NO"].map((kind) => {
    const r = exitWalk(outcomeLevels(kind, bids, asks, 32, f), BigInt(lots));
    return { kind, lots: String(lots), proceeds: String(r.proceeds), filled: String(r.filled) };
  }));
  const quotes = c.quotes.map((q) => {
    const r = quoteStake(outcomeLevels(q.side, bids, asks, 32, f), q.side, BigInt(q.stake), BigInt(q.cu), BigInt(q.minLots), q.slippageBps, q.minTicks);
    return { ...q, result: r && { limitTicks: r.limitTicks, yesPriceTicks: r.yesPriceTicks, lots: String(r.lots), escrowCash: String(r.escrowCash) } };
  });
  return {
    bidLevels: lv(bookLevels(bids, "bid", c.n, f)),
    askLevels: lv(bookLevels(asks, "ask", c.n, f)),
    top: { bid: top.bid && lv([top.bid])[0], ask: top.ask && lv([top.ask])[0] },
    outcome, vwap, exit, quotes,
  };
}

const q = (side, stake, over = {}) => ({ side, stake: String(stake), cu: "1", minLots: "1", slippageBps: 300, minTicks: 10, ...over });

// Hand-checked: each `check` is worked by hand in the comment and asserted against the mirror below.
const hand = [
  { name: "vwap rounds cost up: 1,000 @ 550 + 1 @ 551 → ⌈550,551 / 1,001⌉ = 551", bids: [], asks: [order(550, 1000), order(551, 1)], n: 32, filter: filter(), walkLots: ["1001"], quotes: [],
    check: (e) => e.vwap[0].vwapTicks === "551" && e.vwap[0].filled === "1001" },
  { name: "BUY_NO takes bids inverted, SELL_NO hits asks inverted", bids: [order(600, 1000), order(620, 4000)], asks: [order(700, 2000)], n: 32, filter: filter(), walkLots: ["4500"], quotes: [],
    check: (e) => JSON.stringify(e.outcome.BUY_NO) === JSON.stringify([[380, "4000"], [400, "1000"]]) && JSON.stringify(e.outcome.SELL_NO) === JSON.stringify([[300, "2000"]])
      // BUY_NO 4,500 lots: ⌈(4,000·380 + 500·400) / 4,500⌉ = ⌈1,720,000 / 4,500⌉ = 383.
      && e.vwap[1].kind === "BUY_NO" && e.vwap[1].vwapTicks === "383" && e.vwap[1].filled === "4500" },
  { name: "expired, dead and unrested orders are skipped (all counted)", n: 32, walkLots: [], quotes: [],
    bids: [order(620, 1000, { expireTs: String(NOW) }), order(620, 500), order(620, 300, { placedSlot: String(SLOT - 10n) }), order(620, 77, { live: false })], asks: [], filter: filter(),
    check: (e) => JSON.stringify(e.bidLevels) === JSON.stringify([[620, "800"]]) },
  { name: "rested_only counts only orders rested ≥ 50 slots", n: 32, walkLots: [], quotes: [],
    bids: [order(620, 1000, { expireTs: String(NOW) }), order(620, 500), order(620, 300, { placedSlot: String(SLOT - 10n) })], asks: [], filter: filter({ restedOnly: true }),
    check: (e) => JSON.stringify(e.bidLevels) === JSON.stringify([[620, "500"]]) },
  { name: "quote_stake stops on a partial level: 2 USDC over 540×2,000, 560×5,000 → 3,472 lots @ 576", bids: [], asks: [order(540, 2000), order(560, 5000)], n: 32, filter: filter(), walkLots: [],
    quotes: [q("BUY_YES", 2_000_000)],
    // 540: max ⌊2e6/540⌋ = 3,703 → take 2,000. 560: max 3,571 → take 1,571 (partial, stop), limit 560.
    // pad max(⌊560·300/1e4⌋ = 16, 10) → 576; refit ⌊2e6/576⌋ = 3,472 ≤ 3,571; escrow 3,472·576 = 1,999,872.
    check: (e) => JSON.stringify(e.quotes[0].result) === JSON.stringify({ limitTicks: 576, yesPriceTicks: 576, lots: "3472", escrowCash: "1999872" }) },
  { name: "BUY_NO quote over a 620 bid: 1 USDC → 2,557 lots, YES price 609", bids: [order(620, 4000)], asks: [], n: 32, filter: filter(), walkLots: [],
    quotes: [q("BUY_NO", 1_000_000)],
    // NO 380: max ⌊1e6/380⌋ = 2,631 < 4,000 → partial; pad max(11, 10) → 391; ⌊1e6/391⌋ = 2,557; escrow 999,787.
    check: (e) => JSON.stringify(e.quotes[0].result) === JSON.stringify({ limitTicks: 391, yesPriceTicks: 609, lots: "2557", escrowCash: "999787" }) },
  { name: "min_lots refuses a quote that fits only 1 lot; cu = 2 scales cash", bids: [], asks: [order(900, 100), order(500, 10)], n: 32, filter: filter(), walkLots: [],
    quotes: [q("BUY_YES", 1_000, { minLots: "5" }), q("BUY_YES", 10_000, { cu: "2" })],
    // 1: 500 first (asks ascending): ⌊1000/500⌋ = 2 → take 2 of 10 (partial, stop); pad max(15, 10) → 515; ⌊1000/515⌋ = 1 < 5 → null.
    // 2: ⌊10000/1000⌋ = 10 → take 10 (full), then 900: ⌊10000/1800⌋ = 5 ≤ 10 stop; pad 515; ⌊10000/1030⌋ = 9; escrow 9·515·2 = 9,270.
    check: (e) => e.quotes[0].result === null && JSON.stringify(e.quotes[1].result) === JSON.stringify({ limitTicks: 515, yesPriceTicks: 515, lots: "9", escrowCash: "9270" }) },
  { name: "exit walk sells 120 into 620×100, 610×50 = 74,200 tick-lots", bids: [order(610, 50), order(620, 100)], asks: [], n: 2, filter: filter(), walkLots: ["120"], quotes: [],
    check: (e) => e.exit[0].proceeds === "74200" && e.exit[0].filled === "120" },
  { name: "n caps the levels returned; an empty side is empty", bids: [order(10, 1), order(20, 1), order(30, 1)], asks: [], n: 2, filter: filter(), walkLots: ["5"], quotes: [q("BUY_YES", 1_000_000)],
    check: (e) => JSON.stringify(e.bidLevels) === JSON.stringify([[30, "1"], [20, "1"]]) && e.askLevels.length === 0 && e.top.ask === null && e.quotes[0].result === null && e.vwap[0].filled === "0" },
];

function rng(seed) {
  let x = seed >>> 0 || 1;
  return () => { x ^= x << 13; x >>>= 0; x ^= x >>> 17; x ^= x << 5; x >>>= 0; return x; };
}

function randomCase(i) {
  const r = rng(0x9e3779b9 ^ (i * 2654435761));
  const pick = (m) => r() % m;
  const side = () => Array.from({ length: pick(14) }, () => order(1 + pick(999), 1 + pick(5000), {
    expireTs: String(NOW - 5n + BigInt(pick(20))), placedSlot: String(SLOT - BigInt(pick(120))), live: pick(10) !== 0,
  }));
  return {
    name: `random ${i}`, bids: side(), asks: side(), n: 1 + pick(40), filter: filter({ restedOnly: pick(2) === 1, minRestSlots: String(pick(100)) }),
    walkLots: [String(1 + pick(20000)), String(1 + pick(200))],
    quotes: [q("BUY_YES", 1 + pick(5_000_000), { minLots: String(1 + pick(50)), cu: String(1 + pick(3)) }), q("BUY_NO", 1 + pick(5_000_000), { slippageBps: pick(800), minTicks: pick(20) })],
  };
}

const cases = [...hand, ...Array.from({ length: 40 }, (_, i) => randomCase(i))].map(({ check, ...c }) => {
  const expect = expectations(c);
  if (check && !check(expect)) throw new Error(`hand-checked case failed: ${c.name}\n${JSON.stringify(expect, null, 1)}`);
  return { ...c, expect };
});

const doc = "Book-walk vectors shared by agari-common::book_walk (Rust) and packages/core/src/market/book-math.ts (TS). Orders become a Book side by: nodes allocated in REVERSE list order, FIFO within a price = list order, bitmap bit set for every price with a node. Generated by gen-book-vectors.mjs; do not edit by hand.";
const lines = cases.map((c) => `  ${JSON.stringify(c, (_, v) => big(v))}`).join(",\n");
writeFileSync(new URL("./book.vectors.json", import.meta.url), `{\n "_doc": ${JSON.stringify(doc)},\n "cases": [\n${lines}\n ]\n}\n`);
console.log(`wrote ${cases.length} cases`);
