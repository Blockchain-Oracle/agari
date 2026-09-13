import { toMarketId, type Address } from "@masayume/core";
import { marketsProvider } from "@masayume/markets";
import { runSpike, short } from "./lib/boot";

const DAY_SEC = 86_400;
const SETTLED = new Set(["Resolved", "Voided", "Finalized"]);
const json = (value: unknown): string => JSON.stringify(value, (_, v: unknown) => (typeof v === "bigint" ? v.toString() : v), 2);

type Held = { yes: bigint; no: bigint; cost: bigint; proceeds: bigint };

/**
 * Reconstruct per-market holdings chronologically. A sell beyond inventory is a collateral-backed short:
 * the remainder is a buy of the complement at (one − price). Mint/merge router actions add/remove a pair.
 */
function reconstruct(wallet: string, fills: Awaited<ReturnType<Parameters<Parameters<typeof runSpike>[0]>[0]["client"]["getUserFills"]>>, actions: Awaited<ReturnType<Parameters<Parameters<typeof runSpike>[0]>[0]["client"]["getRouterActions"]>>, one: bigint) {
  type Ev = { ts: number; market: string; apply: (h: Held) => void };
  const events: Ev[] = [];
  for (const f of fills) {
    const seat = f.maker === wallet ? "maker" : (f.takerOrder?.owner ?? f.taker) === wallet ? "taker" : null;
    const side = seat === "maker" ? f.makerSide : seat === "taker" ? (f.takerOrder?.side ?? f.takerSide) : null;
    if (!side) continue;
    const q = BigInt(f.quantity);
    const yesPx = BigInt(f.fillPrice);
    const noPx = one - yesPx;
    events.push({
      ts: Number(f.timestamp),
      market: f.market,
      apply: (h) => {
        if (side === "BUY_YES") { h.yes += q; h.cost += (q * yesPx) / one; }
        else if (side === "BUY_NO") { h.no += q; h.cost += (q * noPx) / one; }
        else if (side === "SELL_YES") {
          const sold = q < h.yes ? q : h.yes; const shorted = q - sold;
          h.yes -= sold; h.proceeds += (sold * yesPx) / one;
          h.no += shorted; h.cost += (shorted * noPx) / one;
        } else if (side === "SELL_NO") {
          const sold = q < h.no ? q : h.no; const shorted = q - sold;
          h.no -= sold; h.proceeds += (sold * noPx) / one;
          h.yes += shorted; h.cost += (shorted * yesPx) / one;
        }
      },
    });
  }
  for (const a of actions) {
    if (!a.market) continue;
    const amt = BigInt(a.amount);
    if (a.kind === "MintCompleteSet") events.push({ ts: Number(a.timestamp), market: a.market, apply: (h) => { h.yes += amt; h.no += amt; h.cost += amt; } });
    if (a.kind === "MergeCompleteSet") events.push({ ts: Number(a.timestamp), market: a.market, apply: (h) => { h.yes -= amt; h.no -= amt; h.proceeds += amt; } });
  }
  events.sort((x, y) => x.ts - y.ts);
  const out = new Map<string, Held>();
  for (const e of events) {
    const h = out.get(e.market) ?? { yes: 0n, no: 0n, cost: 0n, proceeds: 0n };
    e.apply(h);
    out.set(e.market, h);
  }
  return out;
}

await runSpike(async ({ env, client }) => {
  const nowSec = Math.floor(Date.now() / 1000);
  const [past, live] = await Promise.all([
    client.listPastBinaryMarkets({ venueId: env.venueId, limit: 100, nowSec }),
    client.listLiveBinaryMarkets({ venueId: env.venueId, limit: 100, nowSec }),
  ]);
  const one = 10n ** BigInt(live[0]?.quoteDecimals ?? past[0]?.quoteDecimals ?? 6);
  const pools = [...new Set([...past, ...live].map((m) => m.poolAddress.toLowerCase()))];
  const counts = new Map<string, number>();
  for (const pool of pools) {
    for (const f of await client.getFills(pool, { since: nowSec - DAY_SEC, limit: 1000 })) for (const w of [f.maker, f.takerOrder?.owner ?? f.taker]) if (w) counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  const wallets = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([w]) => w);

  let openOk = 0, openBad = 0, settledOk = 0, settledBad = 0, settledRedeemed = 0;
  const bad: unknown[] = [];
  for (const wallet of wallets) {
    const [fills, actions] = await Promise.all([client.getUserFills(wallet, { limit: 1000 }), client.getRouterActions(wallet, { limit: 1000 })]);
    const recon = reconstruct(wallet, fills, actions, one);
    const ids = [...recon.keys()].slice(0, 24);
    const markets = new Map((await Promise.all(ids.map((id) => client.getBinaryMarket(id)))).filter(Boolean).map((m) => [m!.marketId.toLowerCase(), m!]));
    for (const id of ids) {
      const m = markets.get(id);
      if (!m) continue;
      const onchain = await marketsProvider.getOnchain(toMarketId(id));
      if (!onchain.ok) continue;
      const chain = await marketsProvider.getHoldings(wallet as Address, onchain.value);
      if (!chain.ok) continue;
      const r = recon.get(id)!;
      const exact = r.yes === chain.value.upRaw && r.no === chain.value.downRaw;
      if (!SETTLED.has(m.status)) { exact ? openOk++ : (openBad++, bad.push({ wallet: short(wallet), id: short(id), status: m.status, recon: [r.yes.toString(), r.no.toString()], chain: [chain.value.upRaw.toString(), chain.value.downRaw.toString()] })); continue; }
      if (exact) { settledOk++; continue; }
      // Settled and different: the only legitimate difference is the redeemed leg(s) gone to zero.
      const win = m.winningOutcome;
      const redeemedLeg = m.voided ? chain.value.upRaw === 0n && chain.value.downRaw === 0n : win === 0 ? chain.value.upRaw === 0n && chain.value.downRaw === r.no : win === 1 ? chain.value.downRaw === 0n && chain.value.upRaw === r.yes : false;
      if (redeemedLeg) settledRedeemed++; else { settledBad++; bad.push({ wallet: short(wallet), id: short(id), status: m.status, win, voided: m.voided, recon: [r.yes.toString(), r.no.toString()], chain: [chain.value.upRaw.toString(), chain.value.downRaw.toString()] }); }
    }
    console.log(`${short(wallet)}: ${ids.length} markets · fills ${fills.length} · actions ${actions.length}`);
  }
  console.log(`\nOPEN markets: exact ${openOk} · mismatch ${openBad}`);
  console.log(`SETTLED markets: exact ${settledOk} · redeemed-leg-only diff ${settledRedeemed} · unexplained ${settledBad}`);
  console.log("unexplained:", json(bad.slice(0, 12)));
});
