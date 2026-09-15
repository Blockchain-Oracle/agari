#!/usr/bin/env -S pnpm exec tsx
// S7 init-vault, ensure-style (vault.md §3.1; D-069): `admin_init_vault` once the agari-vault program is deployed, then
// the VaultDeployment record (program id, seat and config PDAs, collateral, the deploy slot) into the cluster's
// addresses file. The seat registration in program_authorities is `pnpm deploy:set-authorities` (D-063).
// Run: pnpm deploy:init-vault [--cluster devnet|localnet] [--dry-run]
// Payer and admin: the deployer (the vault's upgrade authority).

import { createDeployClient, initVault, vaultAddresses, type StepLog } from "@agari/markets/deploy";
import { addressesFor, clusterArg, endpoints, flag, redactKey, roleSecret, sol } from "./ops-cluster";

const cluster = clusterArg();
const dryRun = flag("--dry-run");
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const { path, file, save } = addressesFor(cluster);
const before = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`init-vault on ${cluster} (${label}) as ${client.payer.address}, balance ${sol(before)} SOL${dryRun ? " — DRY RUN" : ""}`);

try {
  const { program: programId, seat, config } = await vaultAddresses();
  const program = await client.rpc.getAccountInfo(programId, { encoding: "base64" }).send();
  if (!program.value) throw new Error(`agari-vault ${programId} is not deployed on ${cluster}`);
  const existing = await client.rpc.getAccountInfo(config, { encoding: "base64" }).send();
  console.log(`program ${programId}, seat ${seat}, config ${config} (${existing.value ? "exists" : "missing"})`);
  if (dryRun) process.exit(0);
  const log = (entry: StepLog) => console.log(`  ${entry.step.padEnd(12)} ${entry.note}${entry.signature ? `\n  ${"".padEnd(12)} ${entry.signature}` : ""}`);
  const result = await initVault({ client, log });
  const slot = Number((await client.rpc.getSlot({ commitment: "confirmed" }).send()) as unknown as bigint);
  const record = (file.programs.agari_vault ??= {}) as Record<string, unknown>;
  record.programId = programId;
  record.seat = seat;
  record.config = result.config;
  record.fromSlot ??= slot;
  if (result.signature) record.initSignature = result.signature;
  save();
  const after = (await client.rpc.getBalance(client.payer.address).send()).value;
  console.log(`${result.signature ? "initialised" : "already initialised"}; record written to ${path}; balance ${sol(before)} → ${sol(after)} SOL`);
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
