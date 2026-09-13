import { type Address } from "@masayume/core";
import { runSpike, short } from "./lib/boot";

const WALLET: Address = "0xd357019E2c55375477802A047dB7bC1A77819358";
const DAY_SEC = 86_400;

const json = (value: unknown): string => JSON.stringify(value, (_, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2);

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const t0 = Date.now();
  const out = await fn();
  console.log(`⏱ ${label}: ${Date.now() - t0}ms`);
  return out;
}

/** Read-only probe of what the indexer holds for one wallet's complete fill/outcome history. */
await runSpike(async ({ env, client }) => {
  const nowSec = Math.floor(Date.now() / 1000);
  const wallet = WALLET.toLowerCase();

  const count = await timed("countUserFills", () => client.countUserFills(wallet));
  console.log("fill count:", count);

  const fills = await timed("getUserFills(limit 500)", () => client.getUserFills(wallet, { limit: 500 }));
  console.log("fills returned:", fills.length);
  const markets = new Set(fills.map((f) => f.market));
  console.log("distinct markets:", markets.size);
  const attributed = fills.filter((f) => (f.maker === wallet && f.makerSide) || (f.takerOrder?.owner === wallet && f.takerOrder.side) || (f.taker === wallet && f.takerSide));
  console.log("fills with wallet side attributable:", attributed.length);
  console.log("kinds:", json(Object.fromEntries([...new Set(fills.map((f) => f.kind))].map((k) => [k, fills.filter((f) => f.kind === k).length]))));
  console.log("sample fill:", json(fills[0]));
  console.log("oldest fill ts:", fills.at(-1)?.timestamp, "newest:", fills[0]?.timestamp);

  const actions = await timed("getRouterActions(limit 500)", () => client.getRouterActions(wallet, { limit: 500 }));
  console.log("router actions:", actions.length, json(Object.fromEntries(["Redeem", "MintCompleteSet", "MergeCompleteSet"].map((k) => [k, actions.filter((a) => a.kind === k).length]))));
  console.log("sample redeem:", json(actions.find((a) => a.kind === "Redeem")));

  const portfolio = await timed("getPortfolio(tradesLimit 200)", () => client.getPortfolio(wallet, { ordersLimit: 0, tradesLimit: 200 }));
  console.log("portfolio.trades:", portfolio.trades.length, "positions:", portfolio.positions.length);
  console.log("sample portfolio trade:", json(portfolio.trades[0]));
  console.log("trades with side known:", portfolio.trades.filter((t) => t.side !== null).length);

  const fallbacks = await timed("getVaultPayoutFallbacks", () => client.getVaultPayoutFallbacks(wallet, { limit: 50 }));
  console.log("vault payout fallbacks:", fallbacks.length, json(fallbacks[0]));

  const ids = [...markets].slice(0, 8);
  const rows = await timed(`getBinaryMarket × ${ids.length}`, () => Promise.all(ids.map((id) => client.getBinaryMarket(id))));
  console.log(
    "markets:",
    json(
      rows.map((m) =>
        m ? { id: short(m.marketId), status: m.status, win: m.winningOutcome, voided: m.voided, expiry: m.expiry, resolvedAt: m.resolvedAtTimestamp, interval: m.intervalSec, asset: m.asset } : null,
      ),
    ),
  );

  // Venue-wide sizing for the leaderboard: how many fills landed in the last 24h?
  const past = await timed("listPastBinaryMarkets(limit 100)", () => client.listPastBinaryMarkets({ venueId: env.venueId, limit: 100, nowSec }));
  const live = await client.listLiveBinaryMarkets({ venueId: env.venueId, limit: 100, nowSec });
  const pools = new Set([...past, ...live].map((m) => m.poolAddress.toLowerCase()));
  console.log("past markets:", past.length, "live:", live.length, "distinct pools:", pools.size);
  const dayAgo = nowSec - DAY_SEC;
  const inWindow = past.filter((m) => Number(m.expiry) >= dayAgo);
  console.log("past markets expired within 24h (of the 100 fetched):", inWindow.length, "oldest expiry fetched:", past.at(-1)?.expiry, "→", nowSec - Number(past.at(-1)?.expiry ?? nowSec), "s ago");
  let total = 0;
  for (const pool of [...pools].slice(0, 6)) {
    const poolFills = await timed(`getFills(${short(pool)}, since 24h, limit 1000)`, () => client.getFills(pool, { since: dayAgo, limit: 1000 }));
    total += poolFills.length;
    const wallets = new Set(poolFills.flatMap((f) => [f.maker, f.taker, f.takerOrder?.owner].filter(Boolean)));
    console.log(`  pool ${short(pool)}: ${poolFills.length} fills · ${wallets.size} wallets · ${new Set(poolFills.map((f) => f.market)).size} markets`);
  }
  console.log("fills over first 6 pools in 24h:", total);
});
