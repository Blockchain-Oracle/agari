#!/usr/bin/env -S pnpm exec tsx
// S10b drive: prove the reserve prices, opens and settles a real round against a live Window.
//   supply --amount 200      capital for the reserve to lock against rounds
//   open   --market <id>     quotes a band off that Window's own basis and opens at the fresh price
//   settle --round <id>      decides an opened round once its Window resolved, and claims a win or a void
// Run: pnpm exec tsx scripts/drive/range-round.ts <supply|open|settle> [...]
// The chain work lives in `@agari/markets/deploy` (scripts may not import the chain SDKs, plan §6).

import { createDeployClient, liveWindowFor, markWindow, newSigner, probeWindow, openRangeRound, settleRangeRound, supplyRange, type StepLog } from "@agari/markets/deploy";
import { clusterArg, endpoints, redactKey, roleSecret, sol } from "../deploy/ops-cluster";
import { keypairSigner } from "@agari/markets/deploy";

const signerFor = (role: string) => keypairSigner(roleSecret(role));

const mode = process.argv[2] ?? "open";
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const units = (whole: string | undefined, fallback: string) => BigInt(Math.round(Number(whole ?? fallback) * 1e6));

const cluster = clusterArg();
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const log = (e: StepLog) => console.log(`  ${e.step.padEnd(14)} ${e.note}${e.signature ? `\n  ${"".padEnd(14)} ${e.signature}` : ""}`);
const ctx = { client, log };
console.log(`range drive "${mode}" on ${cluster} (${label}) as ${client.payer.address}`);

try {
  if (mode === "supply") {
    const { signature, shares } = await supplyRange(ctx, units(arg("--amount"), "200"));
    console.log(`supplied; reserve shares now ${shares}; ${signature}`);
  } else if (mode === "open") {
    // Either a Window by id, or the one a symbol is trading right now — the lane rolls every hour.
    let marketId = arg("--market");
    if (!marketId) {
      const seriesId = Number(arg("--series") ?? "910");
      const cadence = Number(arg("--cadence") ?? "3600");
      const basis = Number(arg("--basis") ?? "2");
      const live = await liveWindowFor(ctx, seriesId, cadence, basis);
      marketId = live.marketId;
      console.log(`series ${seriesId}/${cadence}s basis ${basis}: live Window #${live.index} ${marketId}`);
    }
    const r = await openRangeRound(ctx, {
      marketId: marketId as never,
      widthBps: BigInt(arg("--width") ?? "50"),
      maxPayoutBase: units(arg("--amount"), "10"),
      isInside: arg("--side") !== "outside",
    });
    console.log(`window open ${r.openingPrint}, mark ${r.centerQE6}e-6, ${r.tauSec}s left`);
    console.log(`band [${r.lowPrint}, ${r.highPrint}] inside p=${r.insideProbE6}e-6; quoted stake ${r.quotedStakeBase}`);
    if (r.booked) {
      console.log(`round ${r.roundId} at ${r.round}: stake ${r.booked.stakeBase}, payout ${r.booked.maxPayoutBase}, house locked ${r.booked.houseLockedBase}, p=${r.booked.probRaw}`);
    }
    console.log(r.signature);
  } else if (mode === "settle") {
    const r = await settleRangeRound(ctx, BigInt(arg("--round") ?? "1"));
    console.log(`round -> status ${r.status}, closing print ${r.closingPrint}; settle ${r.signature}${r.claimSignature ? `; claim ${r.claimSignature}` : " (nothing to claim)"}`);
  } else if (mode === "mark") {
    // A Window the venue has never traded has no mark, and the reserve is right to refuse it. This crosses two
    // independent wallets so there is an ordinary last price to price against.
    const live = await liveWindowFor(ctx, Number(arg("--series") ?? "910"), Number(arg("--cadence") ?? "3600"), Number(arg("--basis") ?? "2"));
    const taker = await newSigner();
    const faucet = await signerFor("faucet-mint-authority");
    console.log(`marking Window #${live.index} ${live.marketId}; throwaway taker ${taker.address}`);
    const r = await markWindow(ctx, live.marketId, taker, faucet, Number(arg("--ticks") ?? "500"), BigInt(arg("--lots") ?? "500"));
    console.log(`marked: last price ${r.lastPrice}, trades ${r.tradeCount}; rest ${r.rest}; cross ${r.cross}`);
  } else if (mode === "state") {
    // The same read `/games/range` makes, through the same port, so a green page is not a separate claim.
    const { ensureMarkets } = await import("@agari/markets");
    const { marketsEnvInputFrom, parseMarketsEnv } = await import("@agari/markets/env");
    ensureMarkets(parseMarketsEnv(marketsEnvInputFrom(process.env)));
    const { getRangeReserveState } = await import("@agari/markets/range");
    const reading = await getRangeReserveState();
    if (!reading.ok) { console.log("read failed:", JSON.stringify(reading)); }
    else if (!reading.value) console.log("no reserve on this cluster — /games/range would show its pending state");
    else {
      const r = reading.value;
      console.log(`reserve ${r.deployment.rangeReserve}`);
      console.log(`  equity ${r.totalValueBase} | liquid ${r.liquidBase} | locked ${r.lockedBase} | utilisation ${r.utilizationBps} bps`);
      console.log(`  shares ${r.supplyShares} | paused ${r.paused} | margin ${r.params.marginBps} bps | per-expiry cap ${r.params.maxExpiryLockedBase}`);
    }
  } else if (mode === "probe") {
    // Which live Windows the reserve would price, and which it would refuse for want of a mark.
    for (const spec of (arg("--lanes") ?? "910:3600:2,1:604800:1,2:604800:1,7:604800:1").split(",")) {
      const [seriesId, cadence, basis] = spec.split(":").map(Number);
      try {
        const live = await liveWindowFor(ctx, seriesId!, cadence!, basis!);
        const w = await probeWindow(ctx, live.marketId);
        console.log(`series ${seriesId}/${cadence}s b${basis} #${live.index} ${w.marketId}: open ${w.openingPrint}, mark ${w.lastPrice}, trades ${w.tradeCount}, last ${w.lastTradeAgeSec ?? "never"}s ago, ${w.secondsLeft}s left, state ${w.state}`);
      } catch (error) {
        console.log(`series ${seriesId}/${cadence}s b${basis}: ${error instanceof Error ? error.message.slice(0, 90) : error}`);
      }
    }
  } else {
    throw new Error(`unknown mode ${mode}`);
  }
  console.log(`deployer balance ${sol((await client.rpc.getBalance(client.payer.address).send()).value)} SOL`);
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
