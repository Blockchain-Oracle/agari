#!/usr/bin/env -S pnpm exec tsx
// S10a init-parlay, ensure-style: `admin_init_reserve` once the agari-parlay program is deployed, then the reserve
// record (program id, reserve and vault PDAs, the init slot) into the cluster's addresses file.
// Run: pnpm exec tsx scripts/deploy/init-parlay.ts [--cluster devnet|localnet] [--dry-run]
// Payer and admin: the deployer (the program's upgrade authority).

import { createDeployClient, initParlayReserve, parlayAddresses, type StepLog } from "@agari/markets/deploy";
import { addressesFor, clusterArg, endpoints, flag, redactKey, roleSecret, sol } from "./ops-cluster";

const cluster = clusterArg();
const dryRun = flag("--dry-run");
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const { path, file, save } = addressesFor(cluster);
const before = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`init-parlay on ${cluster} (${label}) as ${client.payer.address}, balance ${sol(before)} SOL${dryRun ? " — DRY RUN" : ""}`);

try {
  const { program: programId, reserve, vault } = await parlayAddresses();
  const program = await client.rpc.getAccountInfo(programId, { encoding: "base64" }).send();
  if (!program.value) throw new Error(`agari-parlay ${programId} is not deployed on ${cluster}`);
  const existing = await client.rpc.getAccountInfo(reserve, { encoding: "base64" }).send();
  console.log(`program ${programId}, reserve ${reserve} (${existing.value ? "exists" : "missing"}), vault ${vault}`);
  if (dryRun) process.exit(0);
  const log = (entry: StepLog) => console.log(`  ${entry.step.padEnd(12)} ${entry.note}${entry.signature ? `\n  ${"".padEnd(12)} ${entry.signature}` : ""}`);
  const result = await initParlayReserve({ client, log });
  const slot = Number((await client.rpc.getSlot({ commitment: "confirmed" }).send()) as unknown as bigint);
  const record = (file.programs.agari_parlay ??= {}) as Record<string, unknown>;
  record.reserve = result.reserve;
  record.vault = result.vault;
  record.fromSlot ??= slot;
  if (result.signature) record.initSignature = result.signature;
  save();
  const after = (await client.rpc.getBalance(client.payer.address).send()).value;
  console.log(`${result.signature ? "initialised" : "already initialised"}; record written to ${path}; balance ${sol(before)} → ${sol(after)} SOL`);
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
