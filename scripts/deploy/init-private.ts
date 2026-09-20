#!/usr/bin/env -S pnpm exec tsx
// S10d init-private, ensure-style: `admin_init_desk` once the agari-private program is deployed, naming the desk key,
// then its `["seat"]` PDA registered at program_authorities[3] (D-063). A seat exists only in the Ledgers of Windows
// opened after the registration lands.
// Run: pnpm exec tsx scripts/deploy/init-private.ts [--cluster devnet] [--dry-run]
// Payer and admin: the deployer, which is the program's upgrade authority (D-117). Desk key: the `private-desk` role,
// which is the key the web's desk service signs with (PRIVATE_DESK_PRIVATE_KEY) and which can never withdraw.

import { createDeployClient, initPrivateDesk, privateAddresses, registerPrivateSeat, type StepLog } from "@agari/markets/deploy";
import { addressesFor, clusterArg, endpoints, flag, redactKey, rolePubkey, roleSecret, sol } from "./ops-cluster";

const cluster = clusterArg();
const dryRun = flag("--dry-run");
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const { path: recordPath, file, save } = addressesFor(cluster);
const before = (await client.rpc.getBalance(client.payer.address).send()).value;
const deskKey = rolePubkey("private-desk");
console.log(`init-private on ${cluster} (${label}) as ${client.payer.address}, balance ${sol(before)} SOL${dryRun ? " — DRY RUN" : ""}`);

try {
  const { program: programId, desk, custody, seat } = await privateAddresses();
  const program = await client.rpc.getAccountInfo(programId, { encoding: "base64" }).send();
  if (!program.value) throw new Error(`agari-private ${programId} is not deployed on ${cluster}`);
  const existing = await client.rpc.getAccountInfo(desk, { encoding: "base64" }).send();
  console.log(`program ${programId}, desk ${desk} (${existing.value ? "exists" : "missing"}), custody ${custody}, seat ${seat}, desk key ${deskKey}`);
  if (dryRun) process.exit(0);

  const log = (entry: StepLog) => console.log(`  ${entry.step.padEnd(16)} ${entry.note}${entry.signature ? `\n  ${"".padEnd(16)} ${entry.signature}` : ""}`);
  const result = await initPrivateDesk({ client, log }, deskKey as never);
  const seatSignature = await registerPrivateSeat({ client, log });

  const slot = Number((await client.rpc.getSlot({ commitment: "confirmed" }).send()) as unknown as bigint);
  const record = (file.programs.agari_private ??= {}) as Record<string, unknown>;
  record.desk = result.desk;
  record.custody = result.custody;
  record.seat = result.seat;
  record.deskKey = deskKey;
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
