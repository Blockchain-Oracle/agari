#!/usr/bin/env -S pnpm exec tsx
// S9 live setup: a house strategy the ops runner can actually run, and one funded subscriber for it to trade for.
//
// `strategy-registry.ts` proves the registry with throwaway wallets and nothing trades. This one leaves something
// standing: a creator publishes a momentum strategy bound to the ops runner role's key, and a subscriber whose key
// is kept opens a Trading Balance, grants that runner a STRATEGY grant inside the envelope and subscribes. After
// it, `OPS_ACTORS=strategy-runner` has a live subscriber to act for.
//
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/strategy-live.ts [--cluster devnet]
//        [--runner <address>] [--threshold 1] [--lookback 2] [--scratch <dir>]
// The subscriber's and creator's keys are written to ~/.config/agari/<cluster>/ (never the repo), mode 600.

import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { StrategyMetadata, StrategySpec } from "@agari/core/strategies";
import type { TxOutcome } from "@agari/core/ports";
import type { Address } from "@agari/core";
import { getVaultSnapshot } from "@agari/markets";
import { listLiveSubscribers, listStrategies } from "@agari/markets/strategies";
import { arg, clusterArg, endpoints, redactKey } from "../deploy/ops-cluster";
import { check, openDrive } from "./first-call-kit";
import { ownerSession, pointAtVault, TUSDC } from "./vault-kit";

const cluster = clusterArg();
const scratch = arg("--scratch", "/tmp/agari-strategy-live");
const runner = arg("--runner", "G289o3a8kKrTwJEtHaFFDqz4Y26L8VnUP2vFAebVUxo9") as Address;
const thresholdBps = Number(arg("--threshold", "1"));
const lookback = Number(arg("--lookback", "2"));
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const why = (o: TxOutcome) => (o.status === "confirmed" ? o.txHash : `${o.status}: ${o.diagnosis.kind} · ${o.diagnosis.technical.slice(0, 200)}`);

function keep(name: string, secret: Uint8Array): string {
  const dir = join(homedir(), ".config", "agari", cluster);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${name}.json`);
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify(Array.from(secret)));
    chmodSync(path, 0o600);
  }
  return path;
}

try {
  mkdirSync(scratch, { recursive: true });
  const d = await openDrive({ cluster, rpcUrl, wsUrl: rpcSubscriptionsUrl, scratch });
  await pointAtVault(d);
  console.log(`strategy live setup on ${cluster} (${label}); runner ${runner}`);
  const journal = (name: string) => `${scratch}/live-${name}-journal.json`;

  const creator = await d.newUser("house-creator", 60_000_000n, 2n * TUSDC);
  const subscriber = await d.newUser("house-subscriber", 80_000_000n, 60n * TUSDC);
  console.log(`keys kept: ${keep(`strategy-creator-${creator.address.slice(0, 6)}`, creator.secret)}, ${keep(`strategy-subscriber-${subscriber.address.slice(0, 6)}`, subscriber.secret)}`);

  const spec: StrategySpec = { preset: "momentum", lookback, thresholdBps };
  const metadata: StrategyMetadata = { name: "First move", description: "Leans with the Window once the price has moved off its opening print.", spec };
  const envelope = { maxStakePerTradeBase: 5n * TUSDC, maxDailySpendBase: 40n * TUSDC, maxOpenPositions: 4, maxPriceRaw: 0n };
  const published = await (await ownerSession(d, creator, journal("creator"))).submitter.submitTx({ kind: "strategy-publish", runner, spec, metadata, envelope, feeBase: 0n });
  check(published.status === "confirmed", `published (${why(published)})`);
  const catalogue = await listStrategies();
  check(catalogue.ok && catalogue.value !== null, "the catalogue is readable");
  const strategy = catalogue.value!.filter((s) => s.creator === creator.address).at(-1);
  check(strategy !== undefined && strategy.runner === runner, `strategy #${strategy?.strategyId} names the runner`);
  const strategyId = strategy!.strategyId;

  const session = await ownerSession(d, subscriber, journal("subscriber"));
  const nowSec = Math.floor(d.clock.nowMs() / 1000);
  const caps = { maxStakePerTradeBase: 2n * TUSDC, maxDailySpendBase: 20n * TUSDC, maxOpenPositions: 4, maxPriceRaw: 0n };
  const granted = await session.submitter.submitTx({ kind: "vault-deposit-and-grant", amountBase: 40n * TUSDC, terms: { kind: "strategy", actor: runner, caps, expiresAtSec: nowSec + 7 * 86_400, budgetBase: 30n * TUSDC } });
  check(granted.status === "confirmed", `deposit 40 tUSDC + strategy grant to the runner (${why(granted)})`);
  const snapshot = await getVaultSnapshot(subscriber.address as Address);
  const grant = snapshot.ok && snapshot.value ? snapshot.value.grants.strategy : null;
  check(grant !== null, `strategy grant #${grant?.grantId}, budget ${grant?.budgetBase}, 7 days`);
  const subscribed = await session.submitter.submitTx({ kind: "strategy-subscribe", strategyId, grantId: grant!.grantId, feeBase: 0n });
  check(subscribed.status === "confirmed", `subscribed (${why(subscribed)})`);
  const live = await listLiveSubscribers(strategyId);
  check(live.ok && live.value.some((s) => s.subscriber === subscriber.address && s.live), `the runner's live list for #${strategyId} has ${subscriber.address}`);

  console.log(`\nSTRATEGY_ID=${strategyId}\nSUBSCRIBER=${subscriber.address}\nGRANT_ID=${grant!.grantId}`);
  process.exit(0);
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
