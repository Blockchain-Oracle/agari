// Profile phase (Surfpool only): 10 makers rest NO bids at 500…509, then one BUY_YES IOC @ 600 sweeps all ten in a
// single instruction. Profiled with surfnet_profileTransaction, then sent, and the Market must show 10 new trades.

import {
  chainNowSec, fundUser, KIND, newSigner, openWindow, ORDER_TYPE, placeOrder, placeOrderInstruction, profileOnSurfpool, recycleBooks,
} from "@agari/markets/deploy";
import type { DriveEnv } from "./events-cycle";
import { timeTravel } from "./sources";

const CADENCE_SEC = 300;
const MAKERS = 10;
/** Plan budget for a 10-fill IOC (plan §7.2 S2 CU profile box). */
const BUDGET_CU = 90_000;

export async function profileCycle(env: DriveEnv) {
  if (env.cluster !== "localnet") throw new Error("the profile phase runs on Surfpool only");
  const { ctx, client, mint } = env;
  const start = Math.ceil((await chainNowSec(client)) / CADENCE_SEC) * CADENCE_SEC;
  await timeTravel(env.rpcUrl, start + 1);
  const series = env.venue.series!["TSLA-5m"]!;
  await recycleBooks(ctx, series.address as never, series.books as never);
  const w = await openWindow(ctx, { roller: env.roller, series: series.address as never, mint, tradingStartSec: start });

  for (let i = 0; i < MAKERS; i++) {
    const maker = await newSigner();
    const token = await fundUser(ctx, { faucet: env.faucet, mint, owner: maker.address, amount: 1_000_000n });
    await placeOrder(ctx, w, maker, token, { kind: KIND.buyNo, priceTicks: 500 + i, lots: 1_000n, orderType: ORDER_TYPE.normal });
  }
  const taker = await newSigner();
  const takerToken = await fundUser(ctx, { faucet: env.faucet, mint, owner: taker.address, amount: 10_000_000n });
  const order = { kind: KIND.buyYes, priceTicks: 600, lots: 10_000n, orderType: ORDER_TYPE.ioc, maxFills: 16 };

  const ix = await placeOrderInstruction(ctx, w, taker, takerToken, order);
  const profile = await profileOnSurfpool(ctx, env.rpcUrl, [ix]);
  if (profile.error) throw new Error(`10-fill IOC failed in profile: ${profile.error}\n${profile.logs.slice(-5).join("\n")}`);
  const trades = async () => (await client.agariEvents.accounts.market.fetch(w.market)).data.tradeCount;
  const before = await trades();
  await placeOrder(ctx, w, taker, takerToken, order);
  const fills = (await trades()) - before;
  console.log(
    `  10-fill IOC profile: ${profile.computeUnits} CU, ${profile.bytes} B, ${fills} fills` +
      ` (budget ${BUDGET_CU} CU: ${profile.computeUnits <= BUDGET_CU ? "within" : "OVER"})`,
  );
  if (fills !== BigInt(MAKERS)) throw new Error(`expected ${MAKERS} fills, the Market recorded ${fills}`);
  if (profile.computeUnits > BUDGET_CU) throw new Error("10-fill IOC is over the plan budget");
}
