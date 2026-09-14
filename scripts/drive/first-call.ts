#!/usr/bin/env -S pnpm exec tsx
// S4 first-call drive (first-call.md §7, lane 4b): a keypair session takes IOC calls through the real order lane, the
// Window settles, and the claim goes through the redeem lane or reconciles to the settler's crank.
//   localnet — a Surfpool devnet fork, any hour: opens its own drive-only TEST-ATT-5m Window (attested prints) with a
//     seeded maker and proves: Up fill, Down fill, simulation 6110 → requote → fill, a landed nothingFilled, a send killed
//     mid-flight reconciled by signature on restart, redeem after settle, and the crank-paid reconcile.
//   devnet — the gate, NYSE hours: a faucet-funded user takes an Up IOC fill against the soak's seed maker on the live
//     TSLA-5m Window, waits for the settler, then claims or reconciles its crank. Every signature is printed.
// Run:  pnpm exec tsx scripts/drive/first-call.ts [--cluster localnet|devnet] [--rpc URL] [--ws URL] [--scratch DIR]
// Keys: ~/.config/agari/devnet/<role>.json (deployer pays; roller, faucet-mint-authority, price-attestor, settler sign).

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { devnetDrive } from "./first-call-devnet";
import { forkDrive, killedSendChild } from "./first-call-fork";
import { openDrive } from "./first-call-kit";

const arg = (name: string, fallback: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1]! : fallback);
const cluster = arg("--cluster", "localnet") as "localnet" | "devnet";
if (cluster !== "localnet" && cluster !== "devnet") throw new Error("--cluster must be localnet or devnet");
const rpcUrl = arg("--rpc", cluster === "localnet" ? "http://127.0.0.1:8960" : "https://api.devnet.solana.com");
const wsUrl = arg("--ws", cluster === "localnet" ? "ws://127.0.0.1:8961" : "wss://api.devnet.solana.com");
// Journals and the child's hand-off file live outside the repo.
const scratch = process.argv.includes("--scratch") ? arg("--scratch", "") : mkdtempSync(join(tmpdir(), "agari-first-call-"));

if (process.argv.includes("--child")) {
  await killedSendChild(arg("--state", ""));
} else {
  const d = await openDrive({ cluster, rpcUrl, wsUrl, scratch });
  console.log(`first-call drive on ${cluster} (${rpcUrl}), config ${d.config}, mint ${d.mint}`);
  if (cluster === "localnet") await forkDrive(d);
  else await devnetDrive(d);
  process.exit(0);
}
