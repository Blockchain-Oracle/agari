#!/usr/bin/env -S pnpm exec tsx
// verify-index (S3 gate): an independent chain walk of agari-events vs the indexer's idx_ tables at the same head slot.
// Run:  pnpm drive:verify-index [--cluster devnet|localnet] [--json]
// Env:  DATABASE_URL (the indexer's database), HELIUS_API_KEY (devnet) or SURFPOOL_PORT (localnet), INDEXER_RPS.
// The comparison lives with the indexer (services/ops); `@agari/db` is not a dependency of @agari/scripts, so this CLI
// imports it by path.
import { readFileSync } from "node:fs";
import { closeVerifyDb, verifyIndex } from "../../services/ops/src/actors/indexer/verify";

const arg = (name: string, fallback: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1]! : fallback);
const cluster = arg("--cluster", "devnet");
if (cluster !== "devnet" && cluster !== "localnet") throw new Error("--cluster must be devnet or localnet");
const helius = process.env.HELIUS_API_KEY;
const redact = (text: string) => (helius ? text.replaceAll(helius, "<HELIUS_API_KEY>") : text);
const port = process.env.SURFPOOL_PORT ?? "8899";
const wsPort = process.env.SURFPOOL_WS_PORT ?? "8900";
const rpcUrl = cluster === "localnet" ? `http://127.0.0.1:${port}` : helius ? `https://devnet.helius-rpc.com/?api-key=${helius}` : "https://api.devnet.solana.com";
const rpcSubscriptionsUrl = cluster === "localnet" ? `ws://127.0.0.1:${wsPort}` : helius ? `wss://devnet.helius-rpc.com/?api-key=${helius}` : "wss://api.devnet.solana.com";
const startSlot =
  cluster === "localnet"
    ? Number(process.env.INDEXER_START_SLOT ?? 0)
    : (JSON.parse(readFileSync("scripts/deploy/addresses.devnet.json", "utf8")) as { programs: { agari_events: { deployedSlot: number } } }).programs.agari_events.deployedSlot;

try {
  const report = await verifyIndex({ rpcUrl, rpcSubscriptionsUrl, startSlot, rps: Number(process.env.INDEXER_RPS ?? 3), log: (line) => console.log(redact(line)) });
  if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else {
    const keys = [...new Set([...Object.keys(report.chain), ...Object.keys(report.index)])].sort();
    console.log(`\n${"metric".padEnd(26)} ${"chain".padStart(8)} ${"index".padStart(8)}`);
    for (const k of keys) console.log(`${k.padEnd(26)} ${String(report.chain[k] ?? "-").padStart(8)} ${String(report.index[k] ?? "-").padStart(8)}`);
    console.log(`\nhead slot ${report.headSlot}; index behind chain head by ${report.lag.behindSlots ?? "-"} slot(s) / ${report.lag.behindSec ?? "-"} s of block time; newest indexed block is ${report.lag.ageSec ?? "-"} s old (block times are meaningless on Surfpool)`);
    console.log(report.ok ? "verify-index: OK — counts match" : `verify-index: MISMATCH\n  - ${report.mismatches.join("\n  - ")}`);
  }
  process.exitCode = report.ok ? 0 : 1;
} catch (error) {
  console.error(redact(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exitCode = 1;
} finally {
  await closeVerifyDb();
}
