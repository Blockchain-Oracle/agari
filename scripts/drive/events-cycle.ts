#!/usr/bin/env -S pnpm exec tsx
// S2 events drive on real prices: one live 5-minute boundary pair during NYSE hours, then a missing-print void.
//   live: TSLA Window (Pyth primary + RedStone check) with mint-pair, direct and burn fills → cross-checked settle →
//         sweep → redeem; alongside it a drive-only TEST Window (attested primary + RedStone check) whose attested price
//         is 1% off RedStone → CrossCheckDivergence void → redeem.
//   void: an NVDA Window with a resting order and no prints → past close_deadline → MissingPrint void → redeem.
//         On Surfpool the clock jumps there; on devnet it waits ≈ 20 minutes.
// Run:  pnpm drive:events [--cluster localnet|devnet] [--phases live,void]
// Env:  PYTH_API_KEY (Hermes trial). Keys from ~/.config/agari/devnet (deployer pays; roller, faucet, attestor sign).

import { readFileSync, writeFileSync } from "node:fs";
import {
  chainNowSec, createDeployClient, driveTestSeries, ensureBooks, ensureSeries, keypairSigner, type PriceSources, type SendContext, type StepLog, type VenueRecord,
} from "@agari/markets/deploy";
import { ensureRole } from "../deploy/roles.mjs";
import { liveCycle } from "./live";
import { voidCycle } from "./void";
import { timeTravel, wallSec } from "./sources";

type Cluster = "devnet" | "localnet";
const arg = (name: string, fallback: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1]! : fallback);
const cluster = arg("--cluster", "localnet") as Cluster;
const phases = new Set(arg("--phases", "live,void").split(","));
if (cluster !== "devnet" && cluster !== "localnet") throw new Error(`--cluster must be devnet or localnet`);

// Devnet goes through Helius when HELIUS_API_KEY is set (the public endpoint rate-limits a 40-transaction drive).
const helius = process.env.HELIUS_API_KEY;
const rpcUrl = cluster === "localnet" ? "http://127.0.0.1:8899" : helius ? `https://devnet.helius-rpc.com/?api-key=${helius}` : "https://api.devnet.solana.com";
const rpcSubscriptionsUrl = cluster === "localnet" ? "ws://127.0.0.1:8900" : helius ? `wss://devnet.helius-rpc.com/?api-key=${helius}` : "wss://api.devnet.solana.com";
// web3.js 1 fetch errors can carry the request URL: never let the key reach a log.
const redact = (text: string) => (helius ? text.replaceAll(helius, "<HELIUS_API_KEY>") : text);
process.on("uncaughtException", (error) => {
  console.error(redact(error instanceof Error ? `${error.stack ?? error.message}` : String(error)));
  process.exit(1);
});
process.on("unhandledRejection", (reason) => {
  console.error(redact(reason instanceof Error ? `${reason.stack ?? reason.message}` : String(reason)));
  process.exit(1);
});
const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const secretOf = (role: string) => Uint8Array.from(readJson<number[]>(ensureRole(role).path));

// A Surfpool fork that ran init-events itself has addresses.localnet.json; a fresh fork reads devnet's state.
const addressesPath = (() => {
  const local = "scripts/deploy/addresses.localnet.json";
  if (cluster === "localnet") {
    try {
      readFileSync(local);
      return local;
    } catch {
      /* fall through to devnet's */
    }
  }
  return "scripts/deploy/addresses.devnet.json";
})();
const addresses = readJson<{ venue: VenueRecord }>(addressesPath);
const venue = addresses.venue;

const explorer = (sig: string) => (cluster === "devnet" ? `https://explorer.solana.com/tx/${sig}?cluster=devnet` : sig);
export const evidence: Array<StepLog & { atSec: number }> = [];
const log = (entry: StepLog) => {
  evidence.push({ ...entry, atSec: wallSec() });
  console.log(`  ${entry.step.padEnd(18)} ${entry.note}${entry.signature ? `\n  ${"".padEnd(18)} ${explorer(entry.signature)}` : ""}`);
};

const payerSecret = secretOf("deployer");
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret });
const ctx: SendContext = { client, log };
const config = await client.agariEvents.accounts.globalConfig.fetch(venue.config as never);
const sources = readJson<PriceSources>("services/ops/config/price-sources.json");
const before = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`events drive on ${cluster} (${addressesPath}), payer ${client.payer.address}, cluster tag ${config.data.clusterTag}, phases ${[...phases]}`);

/** Surfpool's clock trails the wall clock by a few seconds; prints are admitted on the chain clock, so pull it level. */
export async function syncClock() {
  if (cluster !== "localnet") return;
  const chain = await chainNowSec(client);
  if (chain < wallSec()) await timeTravel(rpcUrl, wallSec());
}

const env = {
  cluster, rpcUrl, ctx, client, payerSecret, venue, sources, syncClock,
  clusterTag: config.data.clusterTag,
  mint: config.data.collateralMint,
  roller: await keypairSigner(secretOf("roller")),
  faucet: await keypairSigner(secretOf("faucet-mint-authority")),
  attestor: await keypairSigner(secretOf("price-attestor")),
};
export type DriveEnv = typeof env;

if (phases.has("live")) {
  const testSpec = driveTestSeries(sources);
  const save = () => writeFileSync(addressesPath, `${JSON.stringify(addresses, null, 2)}\n`);
  const stepCtx = { ...ctx, record: venue, save: (next: VenueRecord) => (Object.assign(venue, next), save()) };
  const testSeries = await ensureSeries(stepCtx, testSpec);
  await ensureBooks(stepCtx, testSpec, testSeries);
  await liveCycle(env, testSeries);
}
if (phases.has("void")) await voidCycle(env);

const after = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`drive done: payer spent ${Number(before - after) / 1e9} SOL, ${evidence.filter((e) => e.signature).length} transactions`);
writeFileSync(`scripts/drive/last-run.${cluster}.json`, `${JSON.stringify({ cluster, evidence }, null, 2)}\n`);
