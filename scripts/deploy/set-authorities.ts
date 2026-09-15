#!/usr/bin/env -S pnpm exec tsx
// S7/S6 set-authorities, ensure-style (D-063; D-055 §2.3 step 5; D-026): one `admin_set_authorities` re-sending every
// current GlobalConfig field with only the intended changes — the vault's ["seat"] PDA at program_authorities[0] and the
// Switchboard queue + min oracles. Skips when identical; refuses when the index holds a different non-zero key.
// Run: pnpm deploy:set-authorities [--cluster devnet|localnet] [--dry-run] [--no-vault] [--no-pin] [--min-oracles 3]
//        [--queue <address>] [--plan data/deploy/authorities-plan.json]
//   --dry-run prints the field diff versus the chain and writes the intended payload to --plan; it sends nothing.
// Payer and admin: the deployer (GlobalConfig admin, D-026).

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createDeployClient, planAuthorities, setAuthorities, SWITCHBOARD_DEVNET_QUEUE_ADDRESS, type StepLog } from "@agari/markets/deploy";
import { arg, clusterArg, endpoints, flag, redactKey, roleSecret, sol } from "./ops-cluster";

const cluster = clusterArg();
const dryRun = flag("--dry-run");
const planPath = arg("--plan", "data/deploy/authorities-plan.json");
const change = {
  vaultSeat: !flag("--no-vault"),
  queue: flag("--no-pin") ? null : (arg("--queue", SWITCHBOARD_DEVNET_QUEUE_ADDRESS) as typeof SWITCHBOARD_DEVNET_QUEUE_ADDRESS),
  minOracles: flag("--no-pin") ? null : Number(arg("--min-oracles", "3")),
};

const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const client = await createDeployClient({ rpcUrl, rpcSubscriptionsUrl, payerSecret: roleSecret("deployer") });
const before = (await client.rpc.getBalance(client.payer.address).send()).value;
console.log(`set-authorities on ${cluster} (${label}) as ${client.payer.address}, balance ${sol(before)} SOL${dryRun ? " — DRY RUN" : ""}`);

try {
  const plan = await planAuthorities(client, change);
  console.log(`config ${plan.config}, admin ${plan.admin}, treasury ${plan.treasury}, vault seat ${plan.vaultSeat}`);
  if (plan.diffs.length === 0) console.log("every field already matches the chain");
  for (const line of plan.diffs) console.log(`  ${line}`);
  mkdirSync(dirname(planPath), { recursive: true });
  writeFileSync(planPath, `${JSON.stringify({ cluster, config: plan.config, treasury: plan.treasury, change, current: plan.current, want: plan.want, diffs: plan.diffs }, null, 2)}\n`);
  console.log(`payload written to ${planPath}`);
  if (dryRun) process.exit(0);
  const log = (entry: StepLog) => console.log(`  ${entry.step.padEnd(16)} ${entry.note}${entry.signature ? `\n  ${"".padEnd(16)} ${entry.signature}` : ""}`);
  const signature = await setAuthorities({ client, log }, plan);
  const after = (await client.rpc.getBalance(client.payer.address).send()).value;
  console.log(`${signature ? "sent" : "nothing sent"}; balance ${sol(before)} → ${sol(after)} SOL`);
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
