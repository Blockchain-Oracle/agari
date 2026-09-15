// Real-print Gap drive on drive-only Series 902 (TSLA's Gap v1: Pyth primary admitted until the lock, RedStone check),
// session-lanes.md §1.6 step 4 / Q-S6-3. A Gap Window over [--open-at, --lock-at, --close-at] is listed at once, then at
// each boundary the drive posts the real prints the relay would: the RedStone check first (its window closes at T + 120),
// then Pyth (post → record → close the update accounts). Between them a minted pair trades and an order at the lock is
// refused; after the close it settles (cross-checked, or single-source past T + 120), redeems and recycles the Book.
// Devnet: the stage owner's overnight Thu 20:00Z → Fri 13:30Z run. Surfpool: a live boundary pair in session, with the
// chain clock pulled level with the wall clock before every print (never ahead of it until the prints are in).

import {
  chainNowSec, decimalToE8, driveGapPythSeries, ensureBooks, ensureSeries, fundUser, keypairSigner, KIND, newSigner, openGapWindow, ORDER_TYPE,
  placeOrder, recordPythPrint, recordRedstonePrint, recycleBooks, redstoneMedianE8, redstonePayload, settleWindow, WHICH,
  type DeployClient, type OpenedGapWindow, type PriceSources, type StepContext,
} from "@agari/markets/deploy";
import { closePythUpdates, postPythUpdates } from "@agari/markets/prices/legacy";
import type { SessionCalendar } from "@agari/core/market";
import type { DriveEnv } from "./events-cycle";
import { redeemAll } from "./redeem";
import { pythUpdateAt, redstoneAt, sleep, timeTravel, waitUntil, wallSec } from "./sources";

type Signer = Awaited<ReturnType<typeof keypairSigner>>;
type Mint = Parameters<typeof fundUser>[1]["mint"];

export type LiveGapEnv = {
  cluster: "devnet" | "localnet";
  rpcUrl: string;
  client: DeployClient;
  ctx: StepContext;
  payerSecret: Uint8Array;
  mint: Mint;
  roller: Signer;
  faucet: Signer;
  sources: PriceSources;
  calendar: SessionCalendar | null;
};

export type LiveGapTimes = { openSec: number; lockSec: number; closeSec: number };

/** Prices at T land within ≈ 10 s on the gateway and Hermes; the check admission ends at T + 120. */
const FETCH_AFTER_SEC = 12;
const iso = (sec: number) => new Date(sec * 1000).toISOString().replace(".000", "");

/** Boundary kinds from the agreed calendar: a session close opens an overnight Gap, a session open closes it. */
function kinds(calendar: SessionCalendar | null, t: LiveGapTimes) {
  const sessions = calendar?.sessions ?? [];
  return {
    openKind: sessions.some((s) => s.closeSec === t.openSec) ? ("SessionClose" as const) : ("Intraday" as const),
    closeKind: sessions.some((s) => s.openSec === t.closeSec) ? ("SessionOpen" as const) : ("Intraday" as const),
  };
}

/** Surfpool only: pull the chain clock level with (or past) the wall clock; the chain admits prints on its own clock. */
async function chainAtLeast(env: LiveGapEnv, sec: number, why: string) {
  if (env.cluster === "localnet" && (await chainNowSec(env.client)) < sec) {
    await timeTravel(env.rpcUrl, sec);
    console.log(`  ⏩ chain ${iso(await chainNowSec(env.client))} (${why})`);
  }
  while ((await chainNowSec(env.client)) < sec) await sleep(1_000);
}

/** RedStone check, then Pyth primary, for one boundary; returns the posted Pyth update accounts. */
async function boundary(env: LiveGapEnv, w: OpenedGapWindow, tSec: number, close: boolean): Promise<string[]> {
  const [primary, check] = close ? [WHICH.close, WHICH.checkClose] : [WHICH.open, WHICH.checkOpen];
  await waitUntil(tSec + FETCH_AFTER_SEC, `the ${close ? "closing" : "opening"} boundary's prices`);
  await chainAtLeast(env, wallSec(), "level with the wall clock");
  const tsla = env.sources.tickers.TSLA!;
  // Five signers are required until T + 60 (the check's strict window); `redstoneAt` settles for three after 60 s.
  const packages = await redstoneAt(tSec, tsla.redstoneFeedId!);
  if (packages.length < 5) await chainAtLeast(env, tSec + 61, "past the check's strict window for a short signer set");
  await recordRedstonePrint(env.ctx, w, check, redstonePayload(packages, tsla.redstoneFeedId!), packages.length);
  const medianE8 = redstoneMedianE8(packages.map((p) => decimalToE8(String(p.dataPoints[0]!.value))));

  const pyth = await pythUpdateAt(tSec, tsla.pythFeedId!);
  const posted = await postPythUpdates({ rpcUrl: env.rpcUrl, payerSecret: env.payerSecret, updatesBase64: pyth.updatesBase64 });
  posted.signatures.forEach((signature, i) => env.ctx.log({ step: "pyth post", signature, note: i === 0 ? `T ${iso(tSec)}, ${pyth.price}e${pyth.expo}` : "" }));
  const update = posted.priceUpdates.find((u) => u.feedIdHex === tsla.pythFeedId);
  if (!update) throw new Error(`Hermes update at ${iso(tSec)} has no TSLA price`);
  await recordPythPrint(env.ctx, w, primary, update.address as never);
  console.log(`  prints @ ${iso(tSec)}: pyth ${pyth.price}e${pyth.expo} (publish ${iso(pyth.publishTime)}), redstone median ${medianE8}e-8 (${packages.length} signers)`);
  return posted.priceUpdates.map((u) => u.address);
}

export async function liveGapCycle(env: LiveGapEnv, t: LiveGapTimes): Promise<void> {
  if (!(t.openSec < t.lockSec && t.lockSec <= t.closeSec)) throw new Error("need --open-at < --lock-at ≤ --close-at");
  if (wallSec() > t.openSec + 60) throw new Error(`--open-at ${iso(t.openSec)} is past: the RedStone check open (T + 120) would be missed`);
  const { ctx } = env;
  const spec = driveGapPythSeries(env.sources);
  const series = await ensureSeries(ctx, spec);
  const books = await ensureBooks(ctx, spec, series);
  await recycleBooks(ctx, series, books);
  await chainAtLeast(env, wallSec(), "level with the wall clock before listing");
  const w = await openGapWindow(ctx, { roller: env.roller, series, mint: env.mint, window: { tradingStartSec: t.openSec, lockAtSec: t.lockSec, expirySec: t.closeSec, ...kinds(env.calendar, t) } });
  const updates = await boundary(env, w, t.openSec, false);

  const [a, d] = [await newSigner(), await newSigner()];
  const aTok = await fundUser(ctx, { faucet: env.faucet, mint: env.mint, owner: a.address, amount: 10_000_000n });
  const dTok = await fundUser(ctx, { faucet: env.faucet, mint: env.mint, owner: d.address, amount: 10_000_000n });
  await placeOrder(ctx, w, a, aTok, { kind: KIND.buyYes, priceTicks: 520, lots: 2_000n, orderType: ORDER_TYPE.normal, expireTs: t.lockSec });
  await placeOrder(ctx, w, d, dTok, { kind: KIND.buyNo, priceTicks: 500, lots: 2_000n, orderType: ORDER_TYPE.ioc, expireTs: t.lockSec });

  // Wait for the lock in real time on both clusters: moving Surfpool's clock ahead of the wall would push the close
  // boundary's prints (fetched on wall time) past the check's T + 120 bound on the chain clock.
  await waitUntil(t.lockSec, "lock_at");
  await chainAtLeast(env, t.lockSec, "lock_at");
  const refused = await placeOrder(ctx, w, a, aTok, { kind: KIND.buyYes, priceTicks: 500, lots: 1_000n, orderType: ORDER_TYPE.ioc, expireTs: t.lockSec }).then(
    () => null,
    (error: unknown) => (error instanceof Error ? error.message : String(error)),
  );
  if (!refused?.includes("agari-events 6100")) throw new Error(`an order at lock_at was not refused with MarketNotTrading: ${refused ?? "it landed"}`);
  console.log("  order at lock_at refused: agari-events 6100 MarketNotTrading ✓");

  updates.push(...(await boundary(env, w, t.closeSec, true)));
  const m = (await env.client.agariEvents.accounts.market.fetch(w.market)).data;
  // Both checks present settle at once; a missing one holds settlement until T + 120 (CrossCheckPending), then single-source.
  if (m.checkOpen.source === 0 || m.checkClose.source === 0) await chainAtLeast(env, t.closeSec + 121, "the check bound for a single-source settle");
  await settleWindow(ctx, w);
  // redeemAll reads only `client` and `ctx` from the events drive's environment.
  await redeemAll({ client: env.client, ctx } as unknown as DriveEnv, w, [[a, aTok], [d, dTok]], spec.key);
  await recycleBooks(ctx, series, books);
  const closed = await closePythUpdates({ rpcUrl: env.rpcUrl, payerSecret: env.payerSecret, addresses: updates });
  closed.forEach((signature) => ctx.log({ step: "pyth reclaim", signature, note: `${updates.length} update accounts closed` }));
}
