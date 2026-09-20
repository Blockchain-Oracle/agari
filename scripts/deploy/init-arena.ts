#!/usr/bin/env -S pnpm exec tsx
// S12b init-arena, ensure-style: `admin_init_arena` once the agari-arena program is deployed, with the launch parameters and tiers,
// then its `["seat"]` PDA registered at program_authorities[4] (D-063). A seat exists only in the Ledgers of Windows
// opened after the registration lands.
// Run: pnpm exec tsx scripts/deploy/init-arena.ts [--cluster devnet] [--dry-run]
// Payer and admin: the deployer, which is the program's upgrade authority (D-118).

import { arenaAddresses, createDeployClient, initArena, registerArenaSeat, type StepLog } from "@agari/markets/deploy";
import { addressesFor, clusterArg, endpoints, flag, redactKey, roleSecret, sol } from "./ops-cluster";

const cluster = clusterArg();
const dryRun = flag("--dry-run");
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const { path: recordPath, file, save } = addressesFor(cluster);
const before = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`init-arena on ${cluster} (${label}) as ${client.payer.address}, balance ${sol(before)} SOL${dryRun ? " — DRY RUN" : ""}`);

try {
  const { program: programId, arena, custody, seat } = await arenaAddresses();
  const program = await client.rpc.getAccountInfo(programId, { encoding: "base64" }).send();
  if (!program.value) throw new Error(`agari-arena ${programId} is not deployed on ${cluster}`);
  const existing = await client.rpc.getAccountInfo(arena, { encoding: "base64" }).send();
  console.log(`program ${programId}, arena ${arena} (${existing.value ? "exists" : "missing"}), custody ${custody}, seat ${seat}`);
  if (dryRun) process.exit(0);

  const log = (entry: StepLog) => console.log(`  ${entry.step.padEnd(16)} ${entry.note}${entry.signature ? `\n  ${"".padEnd(16)} ${entry.signature}` : ""}`);
  const result = await initArena({ client, log }, cluster);
  const seatSignature = await registerArenaSeat({ client, log });

  const slot = Number((await client.rpc.getSlot({ commitment: "confirmed" }).send()) as unknown as bigint);
  const record = (file.programs.agari_arena ??= {}) as Record<string, unknown>;
  record.arena = result.arena;
  record.custody = result.custody;
  record.seat = result.seat;
  record.fromSlot ??= slot;
  if (result.signature) record.initSignature = result.signature;
  if (seatSignature) { record.seatSignature = seatSignature; record.seatFromSlot = slot; }
  save();
  const after = (await client.rpc.getBalance(client.payer.address).send()).value;
  console.log(`${result.signature ? "initialised" : "already initialised"}; record written to ${recordPath}; balance ${sol(before)} → ${sol(after)} SOL`);
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
