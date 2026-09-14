// Live phase: TSLA (Pyth + RedStone check) and TEST (attested + RedStone check) Windows on the same real boundaries.

import {
  DRIVE_ATTESTED_FEED, fundUser, KIND, newSigner, openWindow, ORDER_TYPE, placeOrder, recordAttestedPrint, recordPythPrint,
  recordRedstonePrint, recycleBooks, redstoneMedianE8, redstonePayload, decimalToE8, settleWindow, WHICH, chainNowSec, type OpenedWindow,
} from "@agari/markets/deploy";
import { closePythUpdates, postPythUpdates } from "@agari/markets/prices/legacy";
import type { DriveEnv } from "./events-cycle";
import { redeemAll } from "./redeem";
import { pythUpdateAt, redstoneAt, sleep, waitUntil, wallSec } from "./sources";

const CADENCE_SEC = 300;
/** RedStone's historical endpoint and Hermes both have T within ≈ 10 s; the check window closes at T + 120. */
const FETCH_AFTER_SEC = 12;
const LATEST_START_AFTER_SEC = 45;
const DIVERGENCE_NUM = 101n;

function pickBoundary(): number {
  const now = wallSec();
  const current = Math.floor(now / CADENCE_SEC) * CADENCE_SEC;
  return now - current <= LATEST_START_AFTER_SEC ? current : current + CADENCE_SEC;
}

/** Primary + check prints for one boundary on both Windows. RedStone first: its check window is the tightest. */
async function boundaryPrints(env: DriveEnv, tSec: number, tsla: OpenedWindow, test: OpenedWindow, close: boolean, pythAccounts: string[]) {
  const [primary, check] = close ? [WHICH.close, WHICH.checkClose] : [WHICH.open, WHICH.checkOpen];
  const packages = await redstoneAt(tSec, "TSLA");
  const payload = redstonePayload(packages, "TSLA");
  await recordRedstonePrint(env.ctx, tsla, check, payload, packages.length);
  await recordRedstonePrint(env.ctx, test, check, payload, packages.length);
  const medianE8 = redstoneMedianE8(packages.map((p) => decimalToE8(String(p.dataPoints[0]!.value))));

  const pyth = await pythUpdateAt(tSec, env.sources.tickers.TSLA!.pythFeedId!);
  const posted = await postPythUpdates({ rpcUrl: env.rpcUrl, payerSecret: env.payerSecret, updatesBase64: pyth.updatesBase64 });
  const update = posted.priceUpdates.find((u) => u.feedIdHex === env.sources.tickers.TSLA!.pythFeedId);
  if (!update) throw new Error("Hermes update has no TSLA price");
  pythAccounts.push(...posted.priceUpdates.map((u) => u.address));
  posted.signatures.forEach((signature, i) => env.ctx.log({ step: "pyth post", signature, note: i === 0 ? `T ${tSec}, ${pyth.price}e${pyth.expo}` : "" }));
  await recordPythPrint(env.ctx, tsla, primary, update.address as never);

  // The attested price is 1% above RedStone's median, so the TEST Window's cross-check must void it.
  // `T + min_delay_sec ≤ fetched_at_ts ≤ now` on the chain clock, which may trail the wall clock.
  await waitUntil(tSec + 10, "the attested correction delay");
  await env.syncClock();
  let chainSec = await chainNowSec(env.client);
  while (chainSec < tSec + 10) {
    await sleep(1_000);
    chainSec = await chainNowSec(env.client);
  }
  await recordAttestedPrint(env.ctx, test, {
    attestor: env.attestor, clusterTag: env.clusterTag, which: primary, boundaryTs: tSec, price: (medianE8 * DIVERGENCE_NUM) / 100n,
    feedId: DRIVE_ATTESTED_FEED, barLenSec: 60, fetchedAtTs: chainSec,
  });
  console.log(`  prints @ ${new Date(tSec * 1000).toISOString()}: pyth ${pyth.price}e${pyth.expo}, redstone median ${medianE8}e-8 (${packages.length} signers)`);
}

export async function liveCycle(env: DriveEnv, testSeries: string) {
  const t0 = pickBoundary();
  const t1 = t0 + CADENCE_SEC;
  await waitUntil(t0 + FETCH_AFTER_SEC, "the opening boundary's prices");
  await env.syncClock();
  const { ctx, roller, mint } = env;
  await recycleBooks(ctx, env.venue.series!["TSLA-5m"]!.address as never, env.venue.series!["TSLA-5m"]!.books as never);
  await recycleBooks(ctx, testSeries as never, env.venue.series!["TEST-ATT-5m"]!.books as never);
  const tsla = await openWindow(ctx, { roller, series: env.venue.series!["TSLA-5m"]!.address as never, mint, tradingStartSec: t0 });
  const test = await openWindow(ctx, { roller, series: testSeries as never, mint, tradingStartSec: t0 });
  const pythAccounts: string[] = [];
  await boundaryPrints(env, t0, tsla, test, false, pythAccounts);

  const [a, d] = [await newSigner(), await newSigner()];
  const aTok = await fundUser(ctx, { faucet: env.faucet, mint, owner: a.address, amount: 20_000_000n });
  const dTok = await fundUser(ctx, { faucet: env.faucet, mint, owner: d.address, amount: 20_000_000n });
  const { normal, ioc } = ORDER_TYPE;
  // events-engine.md §2.2 examples 3, 1 and 4 on real tokens: mint pair, direct YES, burn pair.
  await placeOrder(ctx, tsla, a, aTok, { kind: KIND.buyYes, priceTicks: 620, lots: 10_000n, orderType: normal });
  await placeOrder(ctx, tsla, d, dTok, { kind: KIND.buyNo, priceTicks: 600, lots: 4_000n, orderType: ioc });
  await placeOrder(ctx, tsla, a, aTok, { kind: KIND.sellYes, priceTicks: 700, lots: 2_000n, orderType: normal });
  await placeOrder(ctx, tsla, d, dTok, { kind: KIND.buyYes, priceTicks: 710, lots: 1_000n, orderType: ioc });
  await placeOrder(ctx, tsla, d, dTok, { kind: KIND.sellNo, priceTicks: 720, lots: 1_000n, orderType: ioc });
  await placeOrder(ctx, test, a, aTok, { kind: KIND.buyYes, priceTicks: 500, lots: 1_000n, orderType: normal });
  await placeOrder(ctx, test, d, dTok, { kind: KIND.buyNo, priceTicks: 500, lots: 1_000n, orderType: ioc });

  await waitUntil(t1 + FETCH_AFTER_SEC, "the closing boundary's prices");
  await env.syncClock();
  await boundaryPrints(env, t1, tsla, test, true, pythAccounts);
  await settleWindow(ctx, tsla);
  await settleWindow(ctx, test);
  await redeemAll(env, tsla, [[a, aTok], [d, dTok]], "TSLA");
  await redeemAll(env, test, [[a, aTok], [d, dTok]], "TEST");

  const closed = await closePythUpdates({ rpcUrl: env.rpcUrl, payerSecret: env.payerSecret, addresses: pythAccounts });
  closed.forEach((signature) => ctx.log({ step: "pyth close", signature, note: `${pythAccounts.length} update accounts` }));
}
