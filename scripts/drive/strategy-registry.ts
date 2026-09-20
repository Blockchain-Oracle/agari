#!/usr/bin/env -S pnpm exec tsx
// S9 drive: the strategy registry, end to end on devnet, through the app's own sessions and lanes.
//
// A creator publishes a strategy whose words are too long for one transaction, so the publish goes out in pieces
// and is sealed. A subscriber opens a Trading Balance, grants the strategy's runner a STRATEGY grant inside the
// envelope, and subscribes, paying the creator's fee. Then the refusals: a grant wider than the envelope, and a
// subscriber who was shown a lower fee than the strategy now charges. Then the way out: revoke the grant on the
// vault (which is what actually stops a runner), see the subscription go not-live, and unsubscribe.
//
// Every write here is `submitter.submitTx(intent)`: the same call the desk makes. Nothing builds an instruction.
//
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/strategy-registry.ts [--cluster devnet] [--scratch <dir>]

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { encodeStrategyMetadata, parseStrategyMetadata, type StrategyMetadata, type StrategySpec } from "@agari/core/strategies";
import type { TxOutcome } from "@agari/core/ports";
import type { Address } from "@agari/core";
import { getStrategy, listLiveSubscribers, listStrategies, listSubscriptionsOf, planRevision } from "@agari/markets/strategies";
import { getVaultSnapshot } from "@agari/markets";
import { arg, clusterArg, endpoints, redactKey } from "../deploy/ops-cluster";
import { check, openDrive } from "./first-call-kit";
import { ownerSession, pointAtVault, tokenOf, TUSDC } from "./vault-kit";

const cluster = clusterArg();
const scratch = arg("--scratch", "/tmp/agari-strategy-registry");
const { rpcUrl, rpcSubscriptionsUrl, label } = endpoints(cluster);
const SOL_LAMPORTS = 60_000_000n;
const FEE = 1n * TUSDC;
const show = (value: unknown) => JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v));
const why = (o: TxOutcome) => (o.status === "confirmed" ? o.txHash : `${o.status}: ${o.diagnosis.kind} · ${o.diagnosis.technical.slice(0, 220)}`);

async function strategyGrant(owner: string) {
  const reading = await getVaultSnapshot(owner as Address);
  if (!reading.ok || !reading.value) throw new Error(`no vault snapshot for ${owner}`);
  return reading.value.grants.strategy;
}

try {
  mkdirSync(scratch, { recursive: true });
  const d = await openDrive({ cluster, rpcUrl, wsUrl: rpcSubscriptionsUrl, scratch });
  await pointAtVault(d);
  console.log(`strategy registry drive on ${cluster} (${label})`);
  const journal = (name: string) => `${scratch}/strategy-${name}-journal.json`;
  const results: Record<string, unknown> = {};

  const creator = await d.newUser("creator", SOL_LAMPORTS, 2n * TUSDC);
  const subscriber = await d.newUser("subscriber", SOL_LAMPORTS, 40n * TUSDC);
  const stranger = await d.newUser("stranger", SOL_LAMPORTS, 40n * TUSDC);
  // The runner only has to be a key the grants can name; nothing here trades.
  const runner = (await d.newUser("runner", 1_000_000n, 0n)).address as Address;

  // A. Publish, with a persona at the studio's 600-character limit so the words cannot fit one transaction.
  const spec: StrategySpec = { preset: "agent", persona: "Reads the first quarter of each Window and leans with the print when the move is clean. ".repeat(7).slice(0, 600), posture: "guarded", cadences: [300, 900] };
  const metadata: StrategyMetadata = { name: "Quiet open", description: "Follows a clean first move and holds when the tape is noisy. 上がり.", spec };
  const plan = await planRevision(spec, metadata, FEE);
  console.log(`A. publish: ${plan.revision.metadataLen} bytes of metadata in ${1 + plan.rest.length} transactions`);
  check(plan.rest.length >= 1, `the words (${plan.revision.metadataLen} B) need more than one transaction`);
  const creatorSession = await ownerSession(d, creator, journal("creator"));
  const envelope = { maxStakePerTradeBase: 5n * TUSDC, maxDailySpendBase: 20n * TUSDC, maxOpenPositions: 2, maxPriceRaw: 0n };
  const before = (await listStrategies());
  const countBefore = before.ok && before.value ? before.value.length : 0;
  const published = await creatorSession.submitter.submitTx({ kind: "strategy-publish", runner, spec, metadata, envelope, feeBase: FEE });
  check(published.status === "confirmed", `A publish + write + seal (${why(published)})`);
  const catalogue = await listStrategies();
  check(catalogue.ok && catalogue.value !== null && catalogue.value.length === countBefore + 1, `A the catalogue lists one more sealed strategy (${countBefore} → ${catalogue.ok && catalogue.value ? catalogue.value.length : "?"})`);
  const record = catalogue.value!.at(-1)!;
  const strategyId = record.strategyId;
  check(record.metadata === encodeStrategyMetadata(metadata), `A strategy #${strategyId}'s words read back byte for byte`);
  check(parseStrategyMetadata(record.metadata)?.name === "Quiet open" && record.creator === creator.address && record.runner === runner && record.feeBase === FEE && record.subscribers === 0, `A #${strategyId}: creator, runner, fee ${record.feeBase} and envelope ${show(record.envelope)} as published`);
  results.publish = { strategyId, txHash: published.status === "confirmed" ? published.txHash : null, metadataBytes: plan.revision.metadataLen, transactions: 1 + plan.rest.length };

  // B. The subscriber opens a Trading Balance and grants the runner a STRATEGY grant inside the envelope.
  console.log("B. deposit + strategy grant");
  const subSession = await ownerSession(d, subscriber, journal("subscriber"));
  const nowSec = Math.floor(d.clock.nowMs() / 1000);
  const inside = { maxStakePerTradeBase: 2n * TUSDC, maxDailySpendBase: 10n * TUSDC, maxOpenPositions: 2, maxPriceRaw: 0n };
  const granted = await subSession.submitter.submitTx({ kind: "vault-deposit-and-grant", amountBase: 20n * TUSDC, terms: { kind: "strategy", actor: runner, caps: inside, expiresAtSec: nowSec + 86_400, budgetBase: 10n * TUSDC } });
  check(granted.status === "confirmed", `B open + deposit 20 tUSDC + strategy grant (${why(granted)})`);
  const grant = await strategyGrant(subscriber.address);
  check(grant !== null && grant.actor === runner && !grant.revoked, `B strategy grant #${grant?.grantId} → the runner, budget ${grant?.budgetBase}`);
  results.grant = { grantId: grant!.grantId, txHash: granted.status === "confirmed" ? granted.txHash : null };

  // C. Subscribe: consent on record, and the fee goes straight to the creator.
  console.log("C. subscribe");
  const creatorBefore = await tokenOf(creator.address, d.mint);
  const subscriberBefore = await tokenOf(subscriber.address, d.mint);
  const subscribed = await subSession.submitter.submitTx({ kind: "strategy-subscribe", strategyId, grantId: grant!.grantId, feeBase: FEE });
  check(subscribed.status === "confirmed", `C subscribe (${why(subscribed)})`);
  const creatorAfter = await tokenOf(creator.address, d.mint);
  const subscriberAfter = await tokenOf(subscriber.address, d.mint);
  check(creatorAfter - creatorBefore === FEE && subscriberBefore - subscriberAfter === FEE, `C the fee moved subscriber → creator: −${subscriberBefore - subscriberAfter} / +${creatorAfter - creatorBefore}`);
  const live = await listLiveSubscribers(strategyId);
  check(live.ok && live.value.length === 1 && live.value[0]!.subscriber === subscriber.address && live.value[0]!.live, `C the runner's list has exactly this subscriber, live, on grant #${live.ok ? live.value[0]?.grantId : "?"}`);
  const counted = await getStrategy(strategyId);
  check(counted.ok && counted.value?.subscribers === 1, "C the strategy counts 1 subscriber");
  results.subscribe = { txHash: subscribed.status === "confirmed" ? subscribed.txHash : null };

  // D. Refusals. A grant wider than the envelope; and a subscriber who was shown a lower fee than is charged.
  console.log("D. refusals");
  const strangerSession = await ownerSession(d, stranger, journal("stranger"));
  const wide = { ...inside, maxStakePerTradeBase: 6n * TUSDC };
  const wideGrant = await strangerSession.submitter.submitTx({ kind: "vault-deposit-and-grant", amountBase: 20n * TUSDC, terms: { kind: "strategy", actor: runner, caps: wide, expiresAtSec: nowSec + 86_400, budgetBase: 10n * TUSDC } });
  check(wideGrant.status === "confirmed", `D a grant of 6 tUSDC a trade, over the envelope's 5 (${why(wideGrant)})`);
  const strangerGrant = await strategyGrant(stranger.address);
  const refusedWide = await strangerSession.submitter.submitTx({ kind: "strategy-subscribe", strategyId, grantId: strangerGrant!.grantId, feeBase: FEE });
  check(refusedWide.status === "refused" && refusedWide.diagnosis.technical.includes("CapsOutsideEnvelope"), `D refused, nothing sent: ${refusedWide.status === "refused" ? refusedWide.diagnosis.technical.slice(0, 120) : refusedWide.status}`);
  const cheap = await subSession.submitter.submitTx({ kind: "strategy-subscribe", strategyId, grantId: grant!.grantId, feeBase: FEE - 1n });
  check(cheap.status === "refused" && cheap.diagnosis.technical.includes("FeeAboveMax"), `D a fee above what the subscriber was shown is refused: ${cheap.status === "refused" ? cheap.diagnosis.technical.slice(0, 120) : cheap.status}`);

  // E. The way out. Revoking on the vault is what stops the runner; the registry's record then reads not-live.
  console.log("E. revoke + unsubscribe");
  const revoked = await subSession.submitter.submitTx({ kind: "vault-revoke", grantId: grant!.grantId });
  check(revoked.status === "confirmed", `E revoke grant #${grant!.grantId} on the vault (${why(revoked)})`);
  const after = await listSubscriptionsOf(subscriber.address as Address, [strategyId]);
  check(after.ok && after.value.length === 1 && after.value[0]!.active && !after.value[0]!.live, "E consent is still on record and the subscription is no longer live");
  const gone = await listLiveSubscribers(strategyId);
  check(gone.ok && gone.value.length === 0, "E the runner's list is empty");
  const unsubscribed = await subSession.submitter.submitTx({ kind: "strategy-unsubscribe", strategyId });
  check(unsubscribed.status === "confirmed", `E unsubscribe (${why(unsubscribed)})`);
  const final = await getStrategy(strategyId);
  check(final.ok && final.value?.subscribers === 0, "E the strategy counts 0 subscribers");
  results.exit = { revoke: revoked.status === "confirmed" ? revoked.txHash : null, unsubscribe: unsubscribed.status === "confirmed" ? unsubscribed.txHash : null };

  const path = resolve(scratch, `strategy-registry-${Date.now()}.json`);
  writeFileSync(path, show({ cluster, creator: creator.address, subscriber: subscriber.address, stranger: stranger.address, runner, results }));
  console.log(`evidence → ${path}\n${show(results)}`);
  process.exit(0);
} catch (error) {
  console.error(redactKey(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exit(1);
}
