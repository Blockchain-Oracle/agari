#!/usr/bin/env -S pnpm exec tsx
// S6a Monday Gap drive on Surfpool with forward time travel (session-lanes.md §1.6 step 3), on drive-only Gap Series 901:
//   list:   the roller's own Gap plan (planGapSeries on the agreed Alpaca ∩ Pyth calendar) at the chain clock; outside the
//           48 h lead the clock jumps to the listing time, then the Window is opened exactly as planned.
//   open:   the Friday 16:00:00 ET print, posted on Saturday (a Gap admits it until lock_at).
//   trade:  a minted pair over the weekend, orders expiring at the lock.
//   lock:   at Sunday 20:00 ET a new order is refused with MarketNotTrading.
//   close:  the Monday 09:30:00 ET print, settle, sweep, redeem every seat to the base unit, then the Book is recycled.
// DRIVE DATA: 901's primary is attested. Its prices replay the archived TSLA Pyth prints of the real 09-11 → 09-14 weekend
// (the LiteSVM replay's account vectors), relabelled for this future weekend; they are not prints of these dates.
// Run: SURFPOOL_PORT=9061 SURFPOOL_WS_PORT=9062 pnpm drive:gap-cycle
//   Localnet only (Surfpool's clock moves only forward, D-027).
// Real prints on Series 902 (gap-live.ts, Q-S6-3): pnpm drive:gap-cycle --series 902 --open-at <ISO> [--lock-at <ISO>] --close-at <ISO>
//   [--cluster localnet|devnet]; default localnet. Devnet is the stage owner's overnight run (Thu 20:00Z → Fri 13:30Z).

import { readFileSync, writeFileSync } from "node:fs";
import {
  chainNowSec, createDeployClient, DRIVE_GAP_ATTESTED_FEED, driveGapAttestedSeries, ensureBooks, ensureSeries, fundUser, keypairSigner, KIND, newSigner,
  openGapWindow, ORDER_TYPE, placeOrder, recordAttestedPrint, recycleBooks, settleWindow, WHICH, type PriceSources, type StepContext, type StepLog,
} from "@agari/markets/deploy";
import { createSessionService } from "../../services/ops/src/calendar/session-service";
import { DEFAULT_GAP_LEAD_SEC, DEFAULT_LEAD_SEC, DEFAULT_MIN_TRADABLE_SEC, DEFAULT_PRELIST_CADENCES_SEC } from "../../services/ops/src/actors/window-roller/plan";
import { planGapSeries } from "../../services/ops/src/actors/window-roller/plan-gap";
import { versionWindow } from "../../services/ops/src/actors/window-roller/versions";
import { addressesFor, arg, endpoints, readJson, redactKey, roleSecret, sol } from "../deploy/ops-cluster";
import type { DriveEnv } from "./events-cycle";
import { liveGapCycle } from "./gap-live";
import { redeemAll } from "./redeem";
import { timeTravel } from "./sources";

process.on("uncaughtException", (e) => {
  console.error(redactKey(e instanceof Error ? (e.stack ?? e.message) : String(e)));
  process.exit(1);
});
const seriesArg = Number(arg("--series", "901"));
const cluster = arg("--cluster", "localnet");
if (seriesArg !== 901 && seriesArg !== 902) throw new Error("--series is 901 (attested, time travel) or 902 (real prints)");
if (cluster !== "localnet" && (seriesArg === 901 || cluster !== "devnet")) throw new Error("901 runs on Surfpool only; 902 on localnet or devnet");

const iso = (sec: number) => new Date(sec * 1000).toISOString().replace(".000", "");
const evidence: Array<StepLog & { chainSec: number }> = [];
const payerSecret = roleSecret("deployer");
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret });
const { file, save } = addressesFor(cluster);
let clockSec = await chainNowSec(client);
const log = (entry: StepLog) => {
  evidence.push({ ...entry, chainSec: clockSec });
  console.log(`  ${entry.step.padEnd(18)} ${entry.note}${entry.signature ? `\n  ${"".padEnd(18)} ${entry.signature}` : ""}`);
};
const ctx: StepContext = { client, record: file.venue, save: (next) => (Object.assign(file.venue, next), save()), log };
const config = (await client.agariEvents.accounts.globalConfig.fetch(file.venue.config as never)).data;
const [roller, faucet, attestor] = await Promise.all([keypairSigner(roleSecret("roller")), keypairSigner(roleSecret("faucet-mint-authority")), keypairSigner(roleSecret("price-attestor"))]);
const before = (await client.rpc.getBalance(client.payer.address).send()).value;
const sources = readJson<PriceSources>("services/ops/config/price-sources.json");
const sessions = createSessionService({ nowSec: () => clockSec });
console.log(`gap drive ${seriesArg} on ${label}, payer ${client.payer.address}, chain clock ${iso(clockSec)}`);
console.log(`  ${await sessions.refresh(true)}`);

async function finish(): Promise<never> {
  const spent = before - (await client.rpc.getBalance(client.payer.address).send()).value;
  console.log(`gap drive done: ${evidence.filter((e) => e.signature).length} transactions, payer spent ${sol(spent)} SOL`);
  writeFileSync(`scripts/drive/last-run.gap-${cluster}.json`, `${JSON.stringify({ series: seriesArg, evidence }, null, 2)}\n`);
  process.exit(0);
}

if (seriesArg === 902) {
  const at = (name: string) => {
    const sec = Date.parse(arg(name, "")) / 1000;
    if (!Number.isInteger(sec)) throw new Error(`${name} must be a whole-second ISO time`);
    return sec;
  };
  const [openSec, closeSec] = [at("--open-at"), at("--close-at")];
  const lockSec = process.argv.includes("--lock-at") ? at("--lock-at") : Math.min(openSec + 14_400, closeSec);
  const env = { cluster: cluster as "localnet" | "devnet", rpcUrl, client, ctx, payerSecret, mint: config.collateralMint, roller, faucet, sources, calendar: sessions.calendar() };
  await liveGapCycle(env, { openSec, lockSec, closeSec });
  await finish();
}

/** Surfpool only: jump the chain clock forward to `sec` and read it back. */
async function travel(sec: number, why: string) {
  if (sec > clockSec) await timeTravel(rpcUrl, sec);
  clockSec = await chainNowSec(client);
  if (clockSec < sec) throw new Error(`time travel to ${iso(sec)} left the chain clock at ${iso(clockSec)}`);
  console.log(`  ⏩ ${iso(clockSec)} (${why})`);
}

/** Drive data: an archived Pyth `PriceUpdateV2` vector's price at expo −8 (price i64 at byte 73, exponent i32 at 89). */
function vectorE8(name: string): bigint {
  const bytes = Buffer.from(readFileSync(`anchor/tests/vectors/prints/${name}`, "utf8").trim(), "base64");
  const expo = bytes.readInt32LE(89);
  if (expo < -8 || expo > 0) throw new Error(`${name}: expo ${expo}`);
  return bytes.readBigInt64LE(73) * 10n ** BigInt(8 + expo);
}
const [fridayE8, mondayE8] = [vectorE8("pyth-tsla-1789156800.account.b64"), vectorE8("pyth-tsla-1789392600.account.b64")];

// Series 901 (ensure-style, so a re-run on the same fork reuses it), and a Book freed from any earlier drive Window.
const spec = driveGapAttestedSeries(sources);
const series = await ensureSeries(ctx, spec);
const books = await ensureBooks(ctx, spec, series);
await recycleBooks(ctx, series, books);

// 1. List: the roller's Gap plan at the chain clock.
async function plan() {
  const s = (await client.agariEvents.accounts.series.fetch(series)).data;
  const planSeries = {
    key: spec.key, symbol: spec.symbol, cadenceSec: s.cadenceSec, maxLeadSec: s.maxLeadSec, nextIndex: s.nextIndex, lastExpirySec: Number(s.lastExpiry),
    versions: s.policyVersions.slice(0, s.versionCount).map(versionWindow), freeBooks: s.freeBooks.slice(0, s.freeBookCount),
  };
  const clock = { calendar: sessions.calendar(), nowSec: clockSec, leadSec: DEFAULT_LEAD_SEC, gapLeadSec: DEFAULT_GAP_LEAD_SEC, minTradableSec: DEFAULT_MIN_TRADABLE_SEC, skips: [], multipliers: [], halts: {}, prelist: true, prelistCadencesSec: DEFAULT_PRELIST_CADENCES_SEC };
  const result = planGapSeries(planSeries, clock);
  console.log(`  roller plan @ ${iso(clockSec)}: ${result.state}`);
  return result;
}
let planned = await plan();
if (planned.kind === "wait") {
  await travel(planned.wakeSec, "the Gap's 48 h listing lead");
  planned = await plan();
}
if (planned.kind !== "open") throw new Error(`the roller would not list a Gap Window: ${planned.state}`);
const w = await openGapWindow(ctx, { roller, series, mint: config.collateralMint, window: planned.window });
const market = async () => (await client.agariEvents.accounts.market.fetch(w.market)).data;
const listed = await market();
if (Number(listed.openDeadline) !== w.lockAtSec) throw new Error(`open_deadline ${listed.openDeadline} ≠ lock_at ${w.lockAtSec}`);
console.log(`  listed #${w.index}: opens ${iso(w.tradingStartSec)}, locks ${iso(w.lockAtSec)}, settles on ${iso(w.expirySec)}; open deadline = lock_at ✓`);

// 2. The Friday 16:00:00 ET print, posted Saturday 12:00 ET: a Regular Window's print would be ~20 h past its deadline.
await travel(w.tradingStartSec + 72_000, "Saturday, the Friday print posted late");
await recordAttestedPrint(ctx, w, { attestor, clusterTag: config.clusterTag, which: WHICH.open, boundaryTs: w.tradingStartSec, price: fridayE8, feedId: DRIVE_GAP_ATTESTED_FEED, barLenSec: 60, fetchedAtTs: clockSec });

// 3. Weekend trading: A takes Up, D takes Down against it (a minted pair); both orders expire at the lock.
const [a, d] = [await newSigner(), await newSigner()];
const aTok = await fundUser(ctx, { faucet, mint: config.collateralMint, owner: a.address, amount: 10_000_000n });
const dTok = await fundUser(ctx, { faucet, mint: config.collateralMint, owner: d.address, amount: 10_000_000n });
await placeOrder(ctx, w, a, aTok, { kind: KIND.buyYes, priceTicks: 620, lots: 4_000n, orderType: ORDER_TYPE.normal, expireTs: w.lockAtSec });
await placeOrder(ctx, w, d, dTok, { kind: KIND.buyNo, priceTicks: 600, lots: 4_000n, orderType: ORDER_TYPE.ioc, expireTs: w.lockAtSec });

// 4. Sunday 20:00 ET: entry is refused at lock_at.
await travel(w.lockAtSec, "Sunday 20:00 ET, lock_at");
const refused = await placeOrder(ctx, w, a, aTok, { kind: KIND.buyYes, priceTicks: 500, lots: 1_000n, orderType: ORDER_TYPE.ioc, expireTs: w.lockAtSec }).then(
  () => null,
  (error: unknown) => (error instanceof Error ? error.message : String(error)),
);
if (!refused?.includes("agari-events 6100")) throw new Error(`an order at lock_at was not refused with MarketNotTrading: ${refused ?? "it landed"}`);
console.log("  order at lock_at refused: agari-events 6100 MarketNotTrading ✓");

// 5. Monday 09:30:00 ET: the close print (after the 10 s correction delay), settle, redeem, recycle.
await travel(w.expirySec + 10, "Monday 09:30:10 ET");
await recordAttestedPrint(ctx, w, { attestor, clusterTag: config.clusterTag, which: WHICH.close, boundaryTs: w.expirySec, price: mondayE8, feedId: DRIVE_GAP_ATTESTED_FEED, barLenSec: 60, fetchedAtTs: clockSec });
await settleWindow(ctx, w);
const settled = await market();
if (settled.state !== 1 || settled.payoutYes !== 0 || settled.payoutNo !== 10_000_000) throw new Error(`expected Down, got state ${settled.state} ${settled.payoutYes}/${settled.payoutNo}`);
console.log(`  settled Down: ${settled.open.price} → ${settled.close.price} e-8 (drive data) ✓`);
// redeemAll reads only `client` and `ctx` from the events drive's environment.
await redeemAll({ client, ctx } as unknown as DriveEnv, w, [[a, aTok], [d, dTok]], spec.key);
await recycleBooks(ctx, series, books);
const freed = (await client.agariEvents.accounts.series.fetch(series)).data;
if (!freed.freeBooks.slice(0, freed.freeBookCount).includes(w.book)) throw new Error(`Book ${w.book} did not return to the free list`);
console.log(`  Book ${w.book} back on the free list ✓`);

await finish();
