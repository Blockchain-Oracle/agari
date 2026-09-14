#!/usr/bin/env -S pnpm exec tsx
// S2 init-events, ensure-style: tUSDC mint → treasury → GlobalConfig + authorities → TSLA/NVDA Regular 5m Series with
// their D-003 policy versions → 2 Books each. Re-running creates only what is missing and fails loudly on drift.
// Run: pnpm deploy:init-events [--cluster devnet|localnet]
//   devnet   → Helius when HELIUS_API_KEY is set (never printed), else api.devnet.solana.com; writes addresses.devnet.json
//   localnet → Surfpool on 127.0.0.1:8899 (e.g. a devnet fork); writes the gitignored addresses.localnet.json
// Keypairs: ~/.config/agari/devnet/<role>.json (deployer = program upgrade authority = config admin, D-026).

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { CLUSTER_ID } from "@agari/core/constants";
import { createDeployClient, initEvents, keypairSigner, type PriceSources, type VenueRecord } from "@agari/markets/deploy";
import { ensureRole } from "./roles.mjs";

type Cluster = "devnet" | "localnet";

const cluster = (process.argv.includes("--cluster") ? process.argv[process.argv.indexOf("--cluster") + 1] : "devnet") as Cluster;
if (cluster !== "devnet" && cluster !== "localnet") throw new Error(`--cluster must be devnet or localnet, got ${cluster}`);

function endpoints(): { rpcUrl: string; rpcSubscriptionsUrl: string; label: string } {
  if (cluster === "localnet") return { rpcUrl: "http://127.0.0.1:8899", rpcSubscriptionsUrl: "ws://127.0.0.1:8900", label: "surfpool 127.0.0.1:8899" };
  const key = process.env.HELIUS_API_KEY;
  if (!key) return { rpcUrl: "https://api.devnet.solana.com", rpcSubscriptionsUrl: "wss://api.devnet.solana.com", label: "api.devnet.solana.com" };
  return { rpcUrl: `https://devnet.helius-rpc.com/?api-key=${key}`, rpcSubscriptionsUrl: `wss://devnet.helius-rpc.com/?api-key=${key}`, label: "helius devnet" };
}

const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;
const secret = (role: string) => Uint8Array.from(readJson<number[]>(ensureRole(role).path));

const DEPLOY_DIR = "scripts/deploy";
const devnetAddresses = readJson<{ programs: { agari_events: { programId: string; programData: string } }; venue?: VenueRecord }>(
  join(DEPLOY_DIR, "addresses.devnet.json"),
);
const addressesPath = join(DEPLOY_DIR, `addresses.${cluster}.json`);
const addresses = cluster === "devnet" ? devnetAddresses : safeRead(addressesPath) ?? { cluster, programs: devnetAddresses.programs, venue: {} };
const record: VenueRecord = (addresses.venue ??= {});

function safeRead(path: string) {
  try {
    return readJson<typeof devnetAddresses & { cluster: string }>(path);
  } catch {
    return null;
  }
}

const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints();
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: secret("deployer") });
const lamportsBefore = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`init-events on ${cluster} (${label}) as ${client.payer.address}, balance ${Number(lamportsBefore) / 1e9} SOL`);

const explorer = (signature: string) =>
  cluster === "devnet" ? `https://explorer.solana.com/tx/${signature}?cluster=devnet` : signature;

await initEvents({
  client,
  clusterTag: CLUSTER_ID[cluster],
  programData: devnetAddresses.programs.agari_events.programData as never,
  mint: await keypairSigner(secret("tusdc-mint")),
  mintAuthority: ensureRole("faucet-mint-authority").pubkey,
  authorities: { roller: ensureRole("roller").pubkey, attestor: ensureRole("price-attestor").pubkey },
  sources: readJson<PriceSources>("services/ops/config/price-sources.json"),
  record,
  save: () => writeFileSync(addressesPath, `${JSON.stringify(addresses, null, 2)}\n`),
  log: ({ step, signature, note }) => console.log(`  ${step.padEnd(14)} ${note}${signature ? `\n  ${"".padEnd(14)} ${explorer(signature)}` : ""}`),
});

const lamportsAfter = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`done: spent ${Number(lamportsBefore - lamportsAfter) / 1e9} SOL, balance ${Number(lamportsAfter) / 1e9} SOL → ${addressesPath}`);
