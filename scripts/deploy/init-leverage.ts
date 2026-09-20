#!/usr/bin/env -S pnpm exec tsx
// S10c init-leverage, ensure-style: `admin_init_reserve` once the agari-leverage program is deployed, then its
// `["seat"]` PDA registered at program_authorities[2] (D-063). Without the registration the engine gives the
// reserve no PROGRAM seat and every boost refuses, so both steps run here. A seat exists only in the Ledgers of
// Windows opened after the registration lands.
// Run: pnpm exec tsx scripts/deploy/init-leverage.ts [--cluster devnet] [--dry-run]
// Payer and admin: the deployer, which is the program's upgrade authority (D-114).

import { createDeployClient, initLeverageReserve, leverageAddresses, registerLeverageSeat, type StepLog } from "@agari/markets/deploy";
import { addressesFor, clusterArg, endpoints, flag, redactKey, roleSecret, sol } from "./ops-cluster";

const cluster = clusterArg();
const dryRun = flag("--dry-run");
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const { path: recordPath, file, save } = addressesFor(cluster);
const before = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`init-leverage on ${cluster} (${label}) as ${client.payer.address}, balance ${sol(before)} SOL${dryRun ? " — DRY RUN" : ""}`);

try {
  const { program: programId, reserve, custody, seat } = await leverageAddresses();
  const program = await client.rpc.getAccountInfo(programId, { encoding: "base64" }).send();
  if (!program.value) throw new Error(`agari-leverage ${programId} is not deployed on ${cluster}`);
  const existing = await client.rpc.getAccountInfo(reserve, { encoding: "base64" }).send();
  console.log(`program ${programId}, reserve ${reserve} (${existing.value ? "exists" : "missing"}), custody ${custody}, seat ${seat}`);
  if (dryRun) process.exit(0);

  const log = (entry: StepLog) => console.log(`  ${entry.step.padEnd(16)} ${entry.note}${entry.signature ? `\n  ${"".padEnd(16)} ${entry.signature}` : ""}`);
  const result = await initLeverageReserve({ client, log });
  const seatSignature = await registerLeverageSeat({ client, log });

  const slot = Number((await client.rpc.getSlot({ commitment: "confirmed" }).send()) as unknown as bigint);
  const record = (file.programs.agari_leverage ??= {}) as Record<string, unknown>;
  record.reserve = result.reserve;
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
