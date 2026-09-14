// Void phase: an NVDA Window with a resting bid and no prints voids once the open print's deadline passes.

import { chainNowSec, fundUser, recycleBooks, KIND, newSigner, openWindow, ORDER_TYPE, placeOrder, voidExpired } from "@agari/markets/deploy";
import type { DriveEnv } from "./events-cycle";
import { redeemAll } from "./redeem";
import { timeTravel, waitUntil } from "./sources";

const CADENCE_SEC = 300;
const OPEN_ADMISSION_SEC = 900;

export async function voidCycle(env: DriveEnv) {
  await env.syncClock();
  const chainSec = await chainNowSec(env.client);
  let start = Math.floor(chainSec / CADENCE_SEC) * CADENCE_SEC;
  if (chainSec - start > CADENCE_SEC - 30) {
    await waitUntil(start + CADENCE_SEC + 2, "a fresh NVDA Window");
    start += CADENCE_SEC;
  }
  const { ctx, mint } = env;
  await recycleBooks(ctx, env.venue.series!["NVDA-5m"]!.address as never, env.venue.series!["NVDA-5m"]!.books as never);
  const nvda = await openWindow(ctx, { roller: env.roller, series: env.venue.series!["NVDA-5m"]!.address as never, mint, tradingStartSec: start });
  const a = await newSigner();
  const aTok = await fundUser(ctx, { faucet: env.faucet, mint, owner: a.address, amount: 5_000_000n });
  await placeOrder(ctx, nvda, a, aTok, { kind: KIND.buyYes, priceTicks: 500, lots: 1_000n, orderType: ORDER_TYPE.normal });

  // No prints: `public_void_expired` is admissible only once now > open_deadline = T + 900 (PD-6).
  const voidAt = start + OPEN_ADMISSION_SEC + 2;
  if (env.cluster === "localnet") {
    await timeTravel(env.rpcUrl, voidAt);
    console.log(`  surfpool clock → ${new Date(voidAt * 1000).toISOString()}`);
  } else {
    await waitUntil(voidAt + 3, "the open print deadline to pass");
  }
  await voidExpired(ctx, nvda);
  await redeemAll(env, nvda, [[a, aTok]], "NVDA");
}
