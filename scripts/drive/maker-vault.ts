#!/usr/bin/env -S pnpm exec tsx
// S8 drive: prove the maker vault takes capital, rests a two-sided quote on a live Window, and gets its capital
// back through merge and settle.
//   supply --amount 100            capital for the vault to quote with
//   quote  [--series 1 --cadence 604800 --basis 1] [--bid 450 --ask 550 --lots 2000]
//   pull   --market <id>           cancel the vault's resting orders
//   merge  --market <id> --lots N  turn matched YES+NO back into collateral
//   settle --market <id>           redeem the seat on a resolved Window and close its book
//   withdraw --shares N            a provider leaves, at the vault's current value per share
//   state                          the vault's balance sheet, through the app's own port
// Run: pnpm exec tsx scripts/drive/maker-vault.ts <mode> [...]

import {
  createDeployClient, liveWindowFor, mergeMaker, pullMaker, quoteMaker, settleMaker, supplyMaker, withdrawMaker, type StepLog,
} from "@agari/markets/deploy";
import { clusterArg, endpoints, redactKey, roleSecret, sol } from "../deploy/ops-cluster";

const mode = process.argv[2] ?? "state";
const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const units = (whole: string | undefined, fallback: string) => BigInt(Math.round(Number(whole ?? fallback) * 1e6));

const cluster = clusterArg();
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
// Quoting and pulling are the designated maker actor's, enforced on chain, so those modes sign as the maker role
// and everything else as the deployer. A drive that signed everything as the deployer would only prove NotMaker.
const asMaker = mode === "quote" || mode === "pull";
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret(asMaker ? "maker" : "deployer") });
const log = (e: StepLog) => console.log(`  ${e.step.padEnd(14)} ${e.note}${e.signature ? `\n  ${"".padEnd(14)} ${e.signature}` : ""}`);
const ctx = { client, log };
console.log(`maker drive "${mode}" on ${cluster} (${label}) as ${client.payer.address}`);

async function market(): Promise<string> {
  const given = arg("--market");
  if (given) return given;
  const live = await liveWindowFor(ctx, Number(arg("--series") ?? "910"), Number(arg("--cadence") ?? "3600"), Number(arg("--basis") ?? "2"));
  console.log(`live Window #${live.index} ${live.marketId}`);
  return live.marketId;
}

try {
  if (mode === "supply") {
    const { signature, shares } = await supplyMaker(ctx, units(arg("--amount"), "100"));
    console.log(`supplied; vault shares now ${shares}; ${signature}`);
  } else if (mode === "quote") {
    const r = await quoteMaker(ctx, {
      marketId: (await market()) as never,
      bidTicks: Number(arg("--bid") ?? "450"),
      askTicks: Number(arg("--ask") ?? "550"),
      lots: BigInt(arg("--lots") ?? "2000"),
    });
    console.log(`quoted; vault deployed ${r.deployedBase}`);
    if (r.book) console.log(`  book: out ${r.book.escrowOutBase}, back ${r.book.escrowBackBase}, merged ${r.book.mergedBase}, quotes ${r.book.quoteCount}`);
    console.log(r.signature);
  } else if (mode === "pull") {
    console.log(await pullMaker(ctx, (await market()) as never));
  } else if (mode === "merge") {
    console.log(await mergeMaker(ctx, (await market()) as never, BigInt(arg("--lots") ?? "1000")));
  } else if (mode === "settle") {
    const r = await settleMaker(ctx, (await market()) as never);
    console.log(`settled; vault deployed ${r.deployedBase}`);
    if (r.book) console.log(`  book: out ${r.book.escrowOutBase}, back ${r.book.escrowBackBase}, merged ${r.book.mergedBase}, payout ${r.book.payoutBase}, settled ${r.book.settled}`);
    console.log(r.signature);
  } else if (mode === "withdraw") {
    const r = await withdrawMaker(ctx, BigInt(arg("--shares") ?? "10000000"));
    console.log(`withdrew; received ${r.receivedBase} base units; vault shares now ${r.shares}`);
    console.log(r.signature);
  } else if (mode === "book") {
    // What the vault's own quoting actor sees: the depth it must rest outside of.
    const { ensureMarkets } = await import("@agari/markets");
    const { marketsEnvInputFrom, parseMarketsEnv } = await import("@agari/markets/env");
    ensureMarkets(parseMarketsEnv(marketsEnvInputFrom(process.env)));
    const { readPoolTop } = await import("@agari/markets/maker");
    const marketId = await market();
    const m = await client.agariEvents.accounts.market.fetch(marketId as never);
    const top = await readPoolTop(m.data.book as never, 8);
    console.log(`book ${m.data.book}`);
    console.log(`  best bid ${top.bestBidRaw ?? "none"} (depth ${top.bidDepthRaw}) · best ask ${top.bestAskRaw ?? "none"} (depth ${top.askDepthRaw})`);
    console.log(`  tick ${top.tickRaw} · lot ${top.lotRaw} · min lots ${top.minQuantityRaw}`);
  } else if (mode === "state") {
    const { ensureMarkets } = await import("@agari/markets");
    const { marketsEnvInputFrom, parseMarketsEnv } = await import("@agari/markets/env");
    ensureMarkets(parseMarketsEnv(marketsEnvInputFrom(process.env)));
    const { getMakerVaultState } = await import("@agari/markets/maker");
    const reading = await getMakerVaultState();
    if (!reading.ok) console.log("read failed:", JSON.stringify(reading));
    else if (!reading.value) console.log("no maker vault on this cluster — /earn would show its pending state");
    else {
      const v = reading.value;
      console.log(`vault ${v.deployment.marketMakerVault} · maker ${v.maker}`);
      console.log(`  idle ${v.liquidBase} | deployed ${v.deployedBase} | total ${v.totalValueBase} | utilisation ${v.utilizationBps} bps`);
      console.log(`  shares ${v.supplyShares} | share price ${v.sharePriceRaw} | paused ${v.paused}`);
    }
  } else {
    throw new Error(`unknown mode ${mode}`);
  }
  console.log(`deployer balance ${sol((await client.rpc.getBalance(client.payer.address).send()).value)} SOL`);
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
