#!/usr/bin/env -S pnpm exec tsx
// S18 Pre-IPO lane, end to end on devnet (D-100): the Stocklana PreStocks track. Registers an attested-primary Series
// for one PreStocks pre-IPO token, opens a 5-minute Window on it, reads the public catalogue at each boundary, signs
// the price with the venue's price-attestor and records it as an attested print, then settles the Window on the pair.
//
// Attested-primary with no cross-check is deliberate (D-101): no second venue publishes a pre-IPO mark, so a check
// source would void every Window. `validate_policy_version` admits a zero check policy exactly for this case. What a
// Pre-IPO settlement trusts is the venue's own signature over the 158 B message, not PreStocks — the README says so.
//
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/prestocks-attest.ts [--cluster devnet]
//        [--symbol OPENAI] [--ticker 910] [--cadence 300] [--bar current|next] [--dry-run] [--scratch <dir>]
//   --bar current (default) opens the bar already in progress: its open boundary has passed, so that print lands at
//     once and only the close is waited out. --bar next opens a whole bar before it starts, the way the roller does.
//     A bar that has already closed cannot be opened at all: `check_window` rule 5 requires `lock_at > now`.
// Payer and admin: the deployer (GlobalConfig admin, D-026). Signing authority: price-attestor, already in config.attestors.

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  ensureBooks, ensureSeries, keypairSigner, openWindow, preStocksFeedId, preStocksSeries, PRESTOCKS_TICKER_BASE,
  recordAttestedPrint, seriesAddress, settleWindow, WHICH, type OpenedWindow, type StepContext,
} from "@agari/markets/deploy";
import { fetchPreStocks, requireToken, type PreStocksToken } from "@agari/markets/ops/prints";
import { addressesFor, arg, clusterArg, endpoints, flag, redactKey } from "../deploy/ops-cluster";
import { check, openDrive, sleep } from "./first-call-kit";

const cluster = clusterArg();
const symbol = arg("--symbol", "OPENAI").toUpperCase();
const cadenceSec = Number(arg("--cadence", "300"));
const ticker = Number(arg("--ticker", String(PRESTOCKS_TICKER_BASE)));
const bar = arg("--bar", "current");
const dryRun = flag("--dry-run");
const scratch = arg("--scratch", `/tmp/agari-prestocks-${symbol.toLowerCase()}`);
if (!Number.isInteger(cadenceSec) || cadenceSec < 60) throw new Error(`--cadence must be whole seconds >= 60, got ${cadenceSec}`);
if (!Number.isInteger(ticker) || ticker < 1) throw new Error(`--ticker must be a positive whole number, got ${ticker}`);
if (bar !== "current" && bar !== "next") throw new Error(`--bar must be "current" or "next", got "${bar}"`);

const spec = preStocksSeries(symbol, ticker, cadenceSec);
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const feedId = preStocksFeedId(symbol);
const MIN_DELAY_SEC = spec.versions[0]!.primary.minDelaySec;
const BAR_LEN_SEC = spec.versions[0]!.primary.barLenSec;

// A first read before anything is sent: if PreStocks cannot price the symbol there is no lane to build.
const opening = await fetchPreStocks();
const first = requireToken(opening, symbol);
const usd = (e8: bigint) => `$${(Number(e8) / 1e8).toFixed(4)}`;
console.log(`prestocks-attest ${spec.key} on ${cluster} (${label})`);
console.log(`  ${first.name} (${first.symbol}) mint ${first.mint}`);
console.log(`  mark ${usd(first.markPriceE8)}  token ${usd(first.tokenPriceE8)}  (the lane prints the token price)`);
console.log(`  feed id "prestocks-v1:${symbol}", ${BAR_LEN_SEC} s bars, ${MIN_DELAY_SEC} s correction delay, attested primary, no cross-check`);
if (dryRun) {
  console.log(`  DRY RUN: would register ticker ${ticker} / ${cadenceSec} s and open the ${bar} ${cadenceSec} s bar`);
  process.exit(0);
}

const d = await openDrive({ cluster, rpcUrl, wsUrl: rpcSubscriptionsUrl, scratch });
const { file, save } = addressesFor(cluster);
const ctx: StepContext = { ...d.ctx, record: file.venue, save: (next) => { Object.assign(file.venue, next); save(); } };
const attestor = await keypairSigner(d.secretOf("price-attestor"));
const roller = await keypairSigner(d.secretOf("roller"));
const prints: Array<{ which: string; boundaryTs: number; token: PreStocksToken; fetchedAtTs: number; signature: string }> = [];

/** Waits until the chain clock is past `atSec`, then reads PreStocks and records the boundary's attested print. */
async function attest(w: OpenedWindow, which: number, whichName: string, boundaryTs: number): Promise<void> {
  const earliest = boundaryTs + MIN_DELAY_SEC;
  for (;;) {
    const now = Math.floor(d.clock.nowMs() / 1000);
    if (now >= earliest) break;
    console.log(`  waiting ${earliest - now}s for the ${whichName} correction delay`);
    await sleep(Math.min(earliest - now, 30) * 1_000);
  }
  const read = await fetchPreStocks();
  const token = requireToken(read, symbol);
  // The catalogue carries no timestamp, so the venue stamps its own read against the chain's clock: the program needs
  // `boundary + min_delay <= fetched_at <= now`, and a local clock ahead of the chain's would fail the upper bound.
  const fetchedAtTs = Math.min(read.fetchedAtSec, Math.floor(d.clock.nowMs() / 1000));
  check(fetchedAtTs >= earliest, `${whichName}: read at ${fetchedAtTs}, past the ${MIN_DELAY_SEC}s correction delay that ended at ${earliest}`);
  const signature = await recordAttestedPrint(d.ctx, w, {
    attestor, clusterTag: d.clusterTag, which, boundaryTs, price: token.tokenPriceE8, feedId, barLenSec: BAR_LEN_SEC, fetchedAtTs,
  });
  console.log(`  ${whichName} print ${usd(token.tokenPriceE8)} (mark ${usd(token.markPriceE8)}) read at ${new Date(fetchedAtTs * 1000).toISOString()}`);
  prints.push({ which: whichName, boundaryTs, token, fetchedAtTs, signature });
}

try {
  const series = await ensureSeries(ctx, spec);
  await ensureBooks(ctx, spec, series);
  check(String(series) === String(await seriesAddress(spec.ticker, spec.cadenceSec, spec.basis)), `the Series sits at its derived address ${series}`);

  await d.clock.sync();
  const nowSec = Math.floor(d.clock.nowMs() / 1000);
  const thisBoundary = Math.floor(nowSec / cadenceSec) * cadenceSec;
  // `check_window` rule 5 wants the lock still ahead, and the open print needs `now >= boundary + min_delay`. The
  // current bar qualifies only while enough of it is left for the open transaction to land.
  const headroom = thisBoundary + cadenceSec - nowSec;
  const useCurrent = bar === "current" && headroom > MIN_DELAY_SEC + 30;
  if (bar === "current" && !useCurrent) console.log(`  the current bar has ${headroom}s left, too little to open; taking the next one`);
  const tradingStartSec = useCurrent ? thisBoundary : thisBoundary + cadenceSec;
  const expirySec = tradingStartSec + cadenceSec;
  console.log(`  window ${new Date(tradingStartSec * 1000).toISOString()} → ${new Date(expirySec * 1000).toISOString()} (${useCurrent ? "the bar in progress" : "the next bar"})`);

  const opened = await openWindow(d.ctx, { roller, series, mint: d.mint, tradingStartSec });
  await attest(opened, WHICH.open, "open", opened.tradingStartSec);
  await attest(opened, WHICH.close, "close", opened.expirySec);

  const settle = await settleWindow(d.ctx, opened);
  const market = await d.client.agariEvents.accounts.market.fetch(opened.market);
  const [open, close] = [prints[0]!.token.tokenPriceE8, prints[1]!.token.tokenPriceE8];
  const call = close > open ? "UP" : close < open ? "DOWN" : "FLAT";
  const { state, payoutYes, payoutNo, voidReason } = market.data;
  console.log(`  settled ${opened.market}: ${usd(open)} → ${usd(close)}, the close called ${call}`);
  console.log(`  market state ${state}, payout YES ${payoutYes} / NO ${payoutNo}${voidReason ? `, void reason ${voidReason}` : ""}`);
  check(voidReason === 0, "the Window settled on the two prints with no void reason");

  mkdirSync(scratch, { recursive: true });
  const out = resolve(scratch, `prestocks-${symbol.toLowerCase()}-${tradingStartSec}.json`);
  writeFileSync(out, `${JSON.stringify({
    lane: "pre-ipo", source: "prestocks", symbol, seriesKey: spec.key, ticker, cadenceSec, bar: useCurrent ? "current" : "next",
    series: String(series), market: String(opened.market), book: String(opened.book), mint: first.mint,
    tradingStartSec, expirySec, openSignature: opened.signature, settleSignature: settle,
    outcome: call, state, payoutYes, payoutNo, voidReason, resolvedTs: Number(market.data.resolvedTs),
    prints: prints.map((p) => ({ ...p, token: { ...p.token, markPriceE8: String(p.token.markPriceE8), tokenPriceE8: String(p.token.tokenPriceE8) } })),
    evidence: d.evidence,
  }, null, 2)}\n`);
  console.log(`evidence → ${out}`);
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
