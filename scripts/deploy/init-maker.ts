#!/usr/bin/env -S pnpm exec tsx
// S8 init-maker, ensure-style: `admin_init_vault` once the agari-maker program is deployed, then its `["seat"]`
// PDA registered at program_authorities[1] (D-063). Without the registration the engine gives the vault no
// PROGRAM seat and every quote refuses, so both steps run here.
// Run: pnpm exec tsx scripts/deploy/init-maker.ts [--cluster devnet] [--maker <address>] [--dry-run]
// Payer and admin: the deployer.

import { createDeployClient, initMakerVault, makerAddresses, registerMakerSeat, type StepLog } from "@agari/markets/deploy";
import { addressesFor, clusterArg, endpoints, flag, redactKey, roleSecret, sol } from "./ops-cluster";

const cluster = clusterArg();
const dryRun = flag("--dry-run");
const arg = (name: string) => { const i = process.argv.indexOf(name); return i > 0 ? process.argv[i + 1] : undefined; };
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const { path, file, save } = addressesFor(cluster);
const before = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`init-maker on ${cluster} (${label}) as ${client.payer.address}, balance ${sol(before)} SOL${dryRun ? " — DRY RUN" : ""}`);

try {
  const { program: programId, vault, custody, seat } = await makerAddresses();
  const program = await client.rpc.getAccountInfo(programId, { encoding: "base64" }).send();
  if (!program.value) throw new Error(`agari-maker ${programId} is not deployed on ${cluster}`);
  const existing = await client.rpc.getAccountInfo(vault, { encoding: "base64" }).send();
  console.log(`program ${programId}, vault ${vault} (${existing.value ? "exists" : "missing"}), custody ${custody}, seat ${seat}`);
  if (dryRun) process.exit(0);

  // The quoting actor. Defaults to the ops maker role, which is what `MAKER_MODE=vault` runs as.
  const maker = (arg("--maker") ?? client.payer.address) as never;
  const log = (entry: StepLog) => console.log(`  ${entry.step.padEnd(16)} ${entry.note}${entry.signature ? `\n  ${"".padEnd(16)} ${entry.signature}` : ""}`);
  const result = await initMakerVault({ client, log }, maker);
  const seatSignature = await registerMakerSeat({ client, log });

  const slot = Number((await client.rpc.getSlot({ commitment: "confirmed" }).send()) as unknown as bigint);
  const record = (file.programs.agari_maker ??= {}) as Record<string, unknown>;
  record.vault = result.vault;
  record.custody = result.custody;
  record.seat = result.seat;
  record.maker = maker;
  record.fromSlot ??= slot;
  if (result.signature) record.initSignature = result.signature;
  if (seatSignature) record.seatSignature = seatSignature;
  save();
  const after = (await client.rpc.getBalance(client.payer.address).send()).value;
  console.log(`${result.signature ? "initialised" : "already initialised"}; record written to ${path}; balance ${sol(before)} → ${sol(after)} SOL`);
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
