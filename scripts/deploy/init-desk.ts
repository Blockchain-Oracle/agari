#!/usr/bin/env -S pnpm exec tsx
// S21 init-desk, ensure-style (desk.md §4.1–§4.2; D-126): `admin_init_config` once the agari-desk program is deployed
// (USDC, Jupiter v6, attestors = [price-attestor], the cluster tag), then `public_init_reference` for each of the eight
// PreStocks mints. Re-running creates only what is missing and fails loudly on drift. The record goes to
// `scripts/deploy/addresses.mainnet.json` on mainnet-beta and to `--addresses <path>` (never committed) on a fork.
// Run: pnpm deploy:init-desk --cluster mainnet-beta|localnet [--rpc-url <url>] [--ws-url <url>] [--addresses <path>] [--dry-run]
//   mainnet-beta → Helius mainnet when HELIUS_API_KEY is set (never printed), else api.mainnet-beta.solana.com
//   localnet     → Surfpool on 127.0.0.1:${SURFPOOL_PORT:-8899} (a mainnet fork, C6)
// Keys: AGARI_KEYS_DIR (default ~/.config/agari/devnet): deployer = program upgrade authority = config admin, and the
// price-attestor's public key. Missing key files are an error here, never generated (mainnet keys are made by `pnpm roles`).

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { CLUSTER_ID } from "@agari/core/constants";
import { createDeployClient, keypairSigner, type StepLog } from "@agari/markets/deploy";
import { initDesk, JUPITER_V6, readDeskInitPlan, USDC_MAINNET, type DeskInitRecord } from "@agari/markets/desk";
import { addressesFor, arg, flag, redactKey, sol } from "./ops-cluster";

type DeskCluster = "mainnet-beta" | "localnet";

const cluster = arg("--cluster", "") as DeskCluster;
if (cluster !== "mainnet-beta" && cluster !== "localnet") throw new Error(`--cluster must be mainnet-beta or localnet, got "${cluster}"`);
const dryRun = flag("--dry-run");
const keysDir = process.env.AGARI_KEYS_DIR ?? join(homedir(), ".config", "agari", "devnet");

function endpoints(): { rpcUrl: string; rpcSubscriptionsUrl: string; label: string } {
  const rpcUrl = arg("--rpc-url", "");
  const wsUrl = arg("--ws-url", "");
  if (cluster === "localnet") {
    const [http, ws] = [process.env.SURFPOOL_PORT ?? "8899", process.env.SURFPOOL_WS_PORT ?? "8900"];
    return { rpcUrl: rpcUrl || `http://127.0.0.1:${http}`, rpcSubscriptionsUrl: wsUrl || `ws://127.0.0.1:${ws}`, label: `surfpool ${rpcUrl || `127.0.0.1:${http}`}` };
  }
  const key = process.env.HELIUS_API_KEY;
  if (rpcUrl) return { rpcUrl, rpcSubscriptionsUrl: wsUrl || rpcUrl.replace(/^http/, "ws"), label: redactKey(rpcUrl) };
  if (!key) return { rpcUrl: "https://api.mainnet-beta.solana.com", rpcSubscriptionsUrl: "wss://api.mainnet-beta.solana.com", label: "api.mainnet-beta.solana.com" };
  return { rpcUrl: `https://mainnet.helius-rpc.com/?api-key=${key}`, rpcSubscriptionsUrl: `wss://mainnet.helius-rpc.com/?api-key=${key}`, label: "helius mainnet" };
}

/** A role's keypair file, which must already exist: nothing here ever generates a key. */
function roleFile(role: string): number[] {
  const path = join(keysDir, `${role}.json`);
  if (!existsSync(path)) throw new Error(`${path} is missing: make the ${cluster} role keys with AGARI_KEYS_DIR=${keysDir} pnpm roles first`);
  const bytes = JSON.parse(readFileSync(path, "utf8")) as number[];
  if (!Array.isArray(bytes) || bytes.length !== 64) throw new Error(`${path} is not a 64-byte Solana keypair`);
  return bytes;
}

const pubkeyOf = async (bytes: number[]) => (await keypairSigner(Uint8Array.from(bytes))).address;

const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints();
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: Uint8Array.from(roleFile("deployer")) });
const attestor = await pubkeyOf(roleFile("price-attestor"));
const addressesPath = arg("--addresses", "");
const { path, file, save } = addressesFor(cluster, addressesPath || undefined);
const before = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`init-desk on ${cluster} (${label}) as ${client.payer.address}, balance ${sol(before)} SOL, keys ${keysDir}${dryRun ? " — DRY RUN" : ""}`);

try {
  const plan = await readDeskInitPlan(client.rpc);
  const want = { clusterTag: CLUSTER_ID[cluster], usdcMint: USDC_MAINNET, swapProgram: JUPITER_V6, attestors: [attestor] };
  console.log(`program ${plan.programId}: ${plan.programDeployed ? "deployed" : "NOT DEPLOYED"}, upgrade authority ${plan.upgradeAuthority ?? "(none)"}${plan.upgradeAuthority && plan.upgradeAuthority !== client.payer.address ? " ≠ the deployer: admin_init_config would be refused (NotAdmin)" : ""}`);
  console.log(`config ${plan.config.address}: ${plan.config.exists ? "exists" : `missing (rent ${sol(plan.config.rentLamports)} SOL)`}; want usdc ${want.usdcMint}, router ${want.swapProgram}, tag ${want.clusterTag}, attestor ${attestor}`);
  for (const r of plan.references) console.log(`  ref ${r.symbol.padEnd(10)} ${r.address} ${r.exists ? "exists" : "missing"} (mint ${r.mint})`);
  console.log(`plan: ${plan.config.exists ? 0 : 1} config + ${plan.references.filter((r) => !r.exists).length} reference(s) to create, rent ${sol(plan.missingRentLamports)} SOL (${sol(plan.referenceRentLamports)} each)`);
  if (!plan.programDeployed) throw new Error(`agari-desk ${plan.programId} is not deployed on ${cluster}: deploy first (desk.md §10)`);
  if (dryRun) process.exit(0);

  const record = ((file.programs.agari_desk ??= { references: {} }) as unknown) as DeskInitRecord & Record<string, unknown>;
  record.references ??= {};
  if (plan.upgradeAuthority) record.upgradeAuthority = plan.upgradeAuthority;
  const log = (entry: StepLog) => console.log(`  ${entry.step.padEnd(20)} ${entry.note}${entry.signature ? `\n  ${"".padEnd(20)} ${entry.signature}` : ""}`);
  await initDesk({ client, log }, want, record, save);
  const slot = Number((await client.rpc.getSlot({ commitment: "confirmed" }).send()) as unknown as bigint);
  record.fromSlot ??= slot;
  save();
  const after = (await client.rpc.getBalance(client.payer.address).send()).value;
  console.log(`done; record written to ${path}; balance ${sol(before)} → ${sol(after)} SOL (spent ${sol(before - after)})`);
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
