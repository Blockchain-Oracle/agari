#!/usr/bin/env -S pnpm exec tsx
// S9 init-strategy, ensure-style: `admin_init_registry` once the agari-strategy program is deployed, then the
// registry record (program id, registry PDA, the init slot) into the cluster's addresses file.
// Run: pnpm exec tsx scripts/deploy/init-strategy.ts [--cluster devnet|localnet] [--dry-run]
// Payer and admin: the deployer (the program's upgrade authority).

import { createDeployClient, initStrategyRegistry, strategyAddresses, type StepLog } from "@agari/markets/deploy";
import { addressesFor, clusterArg, endpoints, flag, redactKey, roleSecret, sol } from "./ops-cluster";

const cluster = clusterArg();
const dryRun = flag("--dry-run");
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const { path, file, save } = addressesFor(cluster);
const before = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`init-strategy on ${cluster} (${label}) as ${client.payer.address}, balance ${sol(before)} SOL${dryRun ? " — DRY RUN" : ""}`);

try {
  const { program: programId, registry } = await strategyAddresses();
  const program = await client.rpc.getAccountInfo(programId, { encoding: "base64" }).send();
  if (!program.value) throw new Error(`agari-strategy ${programId} is not deployed on ${cluster}`);
  const existing = await client.rpc.getAccountInfo(registry, { encoding: "base64" }).send();
  console.log(`program ${programId}, registry ${registry} (${existing.value ? "exists" : "missing"})`);
  if (dryRun) process.exit(0);
  const log = (entry: StepLog) => console.log(`  ${entry.step.padEnd(14)} ${entry.note}${entry.signature ? `\n  ${"".padEnd(14)} ${entry.signature}` : ""}`);
  const result = await initStrategyRegistry({ client, log });
  const slot = Number((await client.rpc.getSlot({ commitment: "confirmed" }).send()) as unknown as bigint);
  const record = (file.programs.agari_strategy ??= {}) as Record<string, unknown>;
  record.registry = result.registry;
  record.fromSlot ??= slot;
  if (result.signature) record.initSignature = result.signature;
  save();
  const after = (await client.rpc.getBalance(client.payer.address).send()).value;
  console.log(`${result.signature ? "initialised" : "already initialised"}; record written to ${path}; balance ${sol(before)} → ${sol(after)} SOL`);
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
