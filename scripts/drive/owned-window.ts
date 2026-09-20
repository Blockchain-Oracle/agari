#!/usr/bin/env -S pnpm exec tsx
// A Window the drive owns end to end (drive-only Series 903: attested primary, no check, 15 minutes), so a product
// that holds positions across a settlement can be taken to every ending on purpose, on any day of the week.
//   open  [--price 100] [--lanes 1]          ensures each lane's Series and Book, opens them all on one boundary, attests their opening prints
//   quote --window <id> --bid 480 --ask 520 [--lots 20000]   rests both sides from two wallets; calling it again moves the market
//   close --window <id> --price 101          waits for the boundary, attests the closing print and settles (above the open = Up)
// Prices are whole dollars; the engine stores them e-8. The two prints are DRIVE DATA, not market prices.
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/owned-window.ts <mode> [...]

import {
  closeOwnedWindow, createDeployClient, keypairSigner, openOwnedWindow, ownedWindowOf, quoteOwnedWindow, type PriceSources, type StepContext, type StepLog,
} from "@agari/markets/deploy";
import { addressesFor, clusterArg, endpoints, readJson, redactKey, roleSecret } from "../deploy/ops-cluster";

const mode = process.argv[2] ?? "open";
const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const e8 = (dollars: string | undefined, fallback: string) => BigInt(Math.round(Number(dollars ?? fallback) * 1e8));

const cluster = clusterArg();
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const { file, save } = addressesFor(cluster);
const log = (e: StepLog) => console.log(`  ${e.step.padEnd(16)} ${e.note}${e.signature ? `\n  ${"".padEnd(16)} ${e.signature}` : ""}`);
const ctx: StepContext = { client, log, record: file.venue, save: (next) => { Object.assign(file.venue, next); save(); } };
console.log(`owned window "${mode}" on ${cluster} (${label}) as ${client.payer.address}`);

const config = await client.agariEvents.accounts.globalConfig.fetch(file.venue.config as never);
const mint = config.data.collateralMint;

try {
  if (mode === "open") {
    const sources = readJson<PriceSources>("services/ops/config/price-sources.json");
    const keys = { roller: await keypairSigner(roleSecret("roller")), attestor: await keypairSigner(roleSecret("price-attestor")), clusterTag: config.data.clusterTag, mint };
    // A duel's deck needs three live Windows at once, and a Series has one Book, so the lanes are separate Series.
    const lanes = Math.min(3, Math.max(1, Number(arg("--lanes") ?? "1")));
    let boundary: number | undefined;
    for (let lane = 0; lane < lanes; lane += 1) {
      const w = await openOwnedWindow(ctx, keys, sources, e8(arg("--price"), "100"), lane as never, boundary);
      boundary ??= w.tradingStartSec;
      console.log(`window ${w.market}: lane ${lane} #${w.index} ${new Date(w.tradingStartSec * 1000).toISOString()} → ${new Date(w.expirySec * 1000).toISOString()}, book ${w.book}`);
    }
  } else if (mode === "quote" || mode === "close") {
    const id = arg("--window");
    if (!id) throw new Error("--window <market id> is required");
    const w = await ownedWindowOf(ctx, id as never, mint);
    if (mode === "quote") {
      const makers = { bidder: await keypairSigner(roleSecret("drive-bidder")), asker: await keypairSigner(roleSecret("drive-asker")), faucet: await keypairSigner(roleSecret("faucet-mint-authority")) };
      const r = await quoteOwnedWindow(ctx, w, makers, { bidTicks: Number(arg("--bid") ?? "480"), askTicks: Number(arg("--ask") ?? "520"), lots: BigInt(arg("--lots") ?? "20000") });
      console.log(`quoted ${arg("--bid") ?? "480"} / ${arg("--ask") ?? "520"}: ${r.bid} · ${r.ask}`);
    } else {
      const keys = { attestor: await keypairSigner(roleSecret("price-attestor")), clusterTag: config.data.clusterTag };
      const r = await closeOwnedWindow(ctx, w, keys, e8(arg("--price"), "101"));
      console.log(`settled: state ${r.state}, payout yes ${r.payoutYes} / no ${r.payoutNo}, void reason ${r.voidReason}; print ${r.print}; settle ${r.settle}`);
    }
  } else {
    throw new Error(`unknown mode "${mode}"`);
  }
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
