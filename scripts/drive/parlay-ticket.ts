#!/usr/bin/env -S pnpm exec tsx
// S10a drive: prove the reserve prices, opens, settles and pays a real ticket over live Windows.
//   reserve                          the balance sheet as the chain holds it
//   supply --amount 100              capital for the reserve to lock against tickets
//   probe  --legs <leg,leg>          each leg's Window clock and the rested depth the reserve would price from
//   open   --legs <leg,leg> --amount 2   quotes the ticket off the rested books and opens it at the fresh price
//   settle --ticket <id>             decides every leg the venue has answered, in order, then claims a win or a void
//   void   --ticket <id>             the stale backstop
// A leg is `<marketId>:up|down`, or `<ticker>/<cadenceSec>/<basis>:up|down` for the Window that lane is trading now.
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/parlay-ticket.ts <mode> [...]
// The chain work lives in `@agari/markets/deploy` (scripts may not import the chain SDKs, plan §6).

import {
  createDeployClient, liveWindowFor, openParlayTicket, probeParlayLeg, readParlayReserve, settleParlayTicket, supplyParlay,
  voidStaleParlay, type DriveLeg, type StepLog,
} from "@agari/markets/deploy";
import { clusterArg, endpoints, redactKey, roleSecret } from "../deploy/ops-cluster";

const mode = process.argv[2] ?? "probe";
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const units = (whole: string | undefined, fallback: string) => BigInt(Math.round(Number(whole ?? fallback) * 1e6));
const show = (value: unknown) => JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

const cluster = clusterArg();
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const log = (e: StepLog) => console.log(`  ${e.step.padEnd(14)} ${e.note}${e.signature ? `\n  ${"".padEnd(14)} ${e.signature}` : ""}`);
const ctx = { client, log };
console.log(`parlay drive "${mode}" on ${cluster} (${label}) as ${client.payer.address}`);

async function legsOf(spec: string | undefined): Promise<DriveLeg[]> {
  if (!spec) throw new Error("--legs is required, e.g. --legs 910/3600/2:up,<marketId>:down");
  return Promise.all(spec.split(",").map(async (part) => {
    const [where, side] = part.split(":");
    if (!where || (side !== "up" && side !== "down")) throw new Error(`bad leg "${part}"`);
    const lane = where.split("/");
    const marketId = lane.length === 3 ? (await liveWindowFor(ctx, Number(lane[0]), Number(lane[1]), Number(lane[2]))).marketId : where;
    return { marketId: marketId as never, isUp: side === "up" };
  }));
}

try {
  if (mode === "reserve") {
    const r = await readParlayReserve(ctx);
    const locks = r.data.expiryLocks.filter((slot) => slot.lockedBase > 0n);
    console.log(`reserve ${r.reserve}, vault ${r.vault} holds ${r.vaultBase}`);
    console.log(`escrow ${r.data.userEscrowBase}, locked ${r.data.lockedBase}, shares ${r.data.supplyShares}, tickets open ${r.data.ticketsOpen}, next id ${r.data.nextParlayId}`);
    console.log(`boundaries with capital: ${show(locks)}`);
  } else if (mode === "supply") {
    const { signature, shares } = await supplyParlay(ctx, units(arg("--amount"), "100"));
    console.log(`supplied; reserve shares now ${shares}; ${signature}`);
  } else if (mode === "probe") {
    for (const leg of await legsOf(arg("--legs"))) {
      const p = await probeParlayLeg(ctx, leg, Number(arg("--rest") ?? "50"));
      const depth = (levels: typeof p.rested) => levels.reduce((sum, level) => sum + level.quantityRaw, 0n);
      console.log(`${p.marketId} ${p.isUp ? "UP" : "DOWN"}: ${p.status}, ${p.secondsToLock}s to lock, ${p.secondsToExpiry}s to expiry`);
      console.log(`  rested ${depth(p.rested)} raw over ${p.rested.length} levels, best ${show(p.rested.slice(0, 3))}`);
      console.log(`  resting ${depth(p.resting)} raw over ${p.resting.length} levels`);
    }
  } else if (mode === "open") {
    const r = await openParlayTicket(ctx, await legsOf(arg("--legs")), units(arg("--amount"), "2"));
    console.log(`quoted: legs ${show(r.quote.legPricesRaw)}, combined ${r.quote.combinedProbRaw} (product ${r.quote.rawCombinedProbRaw}, correlated ${r.quote.correlated}), stake ${r.quote.stakeBase} for ${r.quote.maxPayoutBase}`);
    if (r.booked) console.log(`ticket ${r.parlayId} at ${r.ticket}: stake ${r.booked.stakeBase}, payout ${r.booked.maxPayoutBase}, house locked ${r.booked.houseLockedBase}, combined ${r.booked.combinedProbRaw}, legs ${show(r.booked.legs.map((l) => ({ market: l.market, up: l.isUp, price: l.priceRaw, expiry: l.expirySec })))}`);
    console.log(r.signature);
  } else if (mode === "settle") {
    const r = await settleParlayTicket(ctx, BigInt(arg("--ticket") ?? "1"));
    console.log(`ticket -> ${r.status}; legs ${show(r.legs.map((l) => l.status))}; ${show(r.signatures)}${r.waitingOn ? `; waiting on leg ${r.waitingOn.legIdx} (${r.waitingOn.market}, boundary ${r.waitingOn.expirySec})` : ""}`);
  } else if (mode === "void") {
    console.log(await voidStaleParlay(ctx, BigInt(arg("--ticket") ?? "1")));
  } else {
    throw new Error(`unknown mode "${mode}"`);
  }
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
