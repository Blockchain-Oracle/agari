#!/usr/bin/env -S pnpm exec tsx
// S10c drive: prove the reserve fronts, holds, sells, settles and pays a real boosted position on live Windows.
//   reserve                                        the balance sheet as the chain holds it
//   fund     --amount 300                          test tUSDC minted to this wallet by the faucet authority
//   supply   --amount 200                          capital for the reserve to front out of
//   withdraw --shares <n>                          a provider leaves, at the reserve's value per share
//   probe    --window <w> --side up --amount 2 --x 2    the Window, its seat, both book sides, and the quote or its refusal
//   open     --window <w> --side up --amount 2 --x 2    opens what the probe quoted, guarded at 95% of its size
//   position --id <n>                              a position with its mark over rested depth against its line
//   close    --id <n> [--min 0]                    the owner's cash-out
//   knock    --id <n> [--owed]                     permissionless, once the mark is under the line
//   settle   --id <n> [--owed]                     permissionless, once the venue has resolved or voided the Window
//   claim    --id <n>                              pays what an exit with --owed left waiting
// `--owed` leaves the owner's token account out, so the money is left owed instead of paid (D-114).
// A Window is a market id, or `<ticker>/<cadenceSec>/<basis>` for the Window that lane is trading now.
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/leverage-boost.ts <mode> [...]
// The chain work lives in `@agari/markets/deploy` (scripts may not import the chain SDKs, plan §6).

import {
  claimLeverage, createDeployClient, exitLeverage, fundUser, keypairSigner, liveWindowFor, openLeverage, probeLeverage, readLeveragePosition, readLeverageReserve,
  supplyLeverage, withdrawLeverage, type BoostSpec, type StepLog,
} from "@agari/markets/deploy";
import { clusterArg, endpoints, flag, redactKey, roleSecret } from "../deploy/ops-cluster";

const mode = process.argv[2] ?? "reserve";
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const units = (whole: string | undefined, fallback: string) => BigInt(Math.round(Number(whole ?? fallback) * 1e6));
const show = (value: unknown) => JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));

const cluster = clusterArg();
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret(arg("--as") ?? "deployer") });
const log = (e: StepLog) => console.log(`  ${e.step.padEnd(14)} ${e.note}${e.signature ? `\n  ${"".padEnd(14)} ${e.signature}` : ""}`);
const ctx = { client, log };
console.log(`leverage drive "${mode}" on ${cluster} (${label}) as ${client.payer.address}`);

async function specOf(): Promise<BoostSpec> {
  const where = arg("--window");
  const side = arg("--side") ?? "up";
  if (!where) throw new Error("--window is required: a market id, or <ticker>/<cadenceSec>/<basis>");
  if (side !== "up" && side !== "down") throw new Error(`bad --side "${side}"`);
  const lane = where.split("/");
  const marketId = lane.length === 3 ? (await liveWindowFor(ctx, Number(lane[0]), Number(lane[1]), Number(lane[2]))).marketId : where;
  return { marketId: marketId as never, side, stakeBase: units(arg("--amount"), "2"), leverageBps: Math.round(Number(arg("--x") ?? "2") * 10_000) };
}

const books = (r: Awaited<ReturnType<typeof readLeverageReserve>>) =>
  `custody ${r.custodyBase}, liquid ${r.liquidBase}, outstanding ${r.data.outstandingBase}, owed to owners ${r.data.userOwedBase}, value ${r.totalValueBase}, shares ${r.data.supplyShares}, open ${r.open.length}, next id ${r.data.nextPositionId}`;
const positionId = () => BigInt(arg("--id") ?? "1");

try {
  if (mode === "reserve") {
    const r = await readLeverageReserve(ctx);
    console.log(`reserve ${r.reserve}, custody ${r.custody}, seat ${r.seat}`);
    console.log(books(r));
    console.log(`params ${show(r.data.params)}; open ${show(r.open)}`);
  } else if (mode === "fund") {
    const r = await readLeverageReserve(ctx);
    const amount = units(arg("--amount"), "300");
    const ata = await fundUser(ctx, { faucet: await keypairSigner(roleSecret("faucet-mint-authority")), mint: r.mint, owner: client.payer.address, amount });
    console.log(`minted ${amount} to ${ata}`);
  } else if (mode === "supply") {
    const { signature, after } = await supplyLeverage(ctx, units(arg("--amount"), "200"));
    console.log(`supplied; ${books(after)}; ${signature}`);
  } else if (mode === "withdraw") {
    const { signature, receivedBase, after } = await withdrawLeverage(ctx, BigInt(arg("--shares") ?? "0"));
    console.log(`withdrew ${receivedBase}; ${books(after)}; ${signature}`);
  } else if (mode === "probe") {
    const spec = await specOf();
    const { reserve, window: w, quote } = await probeLeverage(ctx, spec);
    console.log(`${spec.marketId} ${spec.side}: ${w.status}, ${w.secondsToLock}s to lock, ${w.secondsToExpiry}s to expiry, reserve seated: ${w.seated}`);
    if (w.levels) {
      console.log(`  entry ${show(w.levels.entry.slice(0, 4))}`);
      console.log(`  exit rested ${show(w.levels.exitRested.slice(0, 4))}; resting ${show(w.levels.exitResting.slice(0, 4))}`);
    }
    console.log(`  reserve: ${books(reserve)}`);
    console.log(`  quote: ${show(quote)}`);
  } else if (mode === "open") {
    const r = await openLeverage(ctx, await specOf());
    console.log(`quoted: ${show(r.quote)}`);
    if (r.position) {
      const p = r.position;
      console.log(`position ${r.positionId}: ${p.lots} lots at entry ${p.entryPriceRaw}, stake ${p.stakeBase}, fronted ${p.frontedBase}, premium ${p.premiumBase}; wallet paid ${r.paidBase}`);
      console.log(`identity stake + fronted - premium = ${p.stakeBase + p.frontedBase - p.premiumBase}`);
    }
    console.log(r.signature);
  } else if (mode === "position") {
    const p = await readLeveragePosition(ctx, positionId());
    console.log(`position ${p.data.positionId} ${p.side} ${p.status} on ${p.data.market} (${p.window.status}, ${p.window.secondsToExpiry}s to expiry)`);
    console.log(`  ${p.data.lots} lots, stake ${p.data.stakeBase}, fronted ${p.data.frontedBase}, premium ${p.data.premiumBase}, entry ${p.data.entryPriceRaw}`);
    console.log(`  proceeds ${p.data.proceedsBase}, reclaimed ${p.data.reclaimedBase}, returned ${p.data.returnedBase}, owed ${p.data.owedBase}`);
    console.log(`  mark over rested ${show(p.mark)}, over resting ${show(p.resting)}, line ${p.lineBase}, knockable ${p.knockable}`);
  } else if (mode === "close" || mode === "knock" || mode === "settle") {
    const how = mode === "knock" ? "knock-out" : mode;
    const r = await exitLeverage(ctx, positionId(), how, { minProceedsBase: units(arg("--min"), "0"), payOwner: !flag("--owed") });
    const a = r.after;
    console.log(`before: mark ${show(r.before.mark)}, line ${r.before.lineBase}, knockable ${r.before.knockable}`);
    if (a) console.log(`after: status ${a.status}, lots ${a.lots}, proceeds ${a.proceedsBase}, reclaimed ${a.reclaimedBase}, returned ${a.returnedBase}, owed ${a.owedBase}, fronted ${a.frontedBase}`);
    console.log(`owner received ${r.ownerReceivedBase}; reserve: ${books(r.reserveAfter)}`);
    console.log(r.signature);
  } else if (mode === "claim") {
    const r = await claimLeverage(ctx, positionId());
    console.log(`owed ${r.owedBase}, owner received ${r.ownerReceivedBase}; reserve: ${books(r.reserveAfter)}; ${r.signature}`);
  } else {
    throw new Error(`unknown mode "${mode}"`);
  }
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
