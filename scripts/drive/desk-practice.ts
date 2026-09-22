#!/usr/bin/env -S pnpm exec tsx
// S21 C4 (D-126): a practice desk gets its first paper record, locally, through the real pipeline. Creates a practice
// desk for a throwaway owner in the LOCAL Postgres (`DATABASE_URL`) with the AI Labs preset and the default limits,
// starts the PreStocks spot feed in-process until every name in the mandate has a half-hour mean (three reads, about
// forty seconds and never more than three minutes), then runs ONE wake with trigger `test_read`: real prices, a real
// Jupiter quote at the desk's size, the real model call (the key in `.env.local`). Nothing is signed: a practice desk
// has no on-chain account, and the runner never sends without `DESK_RUNNER_PRIVATE_KEY` and `DRY_RUN=0`.
//
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/desk-practice.ts [--preset ailabs] [--owner <base58>]
//        [--min-warm-sec 40] [--max-warm-sec 180]
//   With no model credential the wake still produces a FAILED_NO_DECISION record that says which variable is missing.

import { randomBytes } from "node:crypto";
import { DEFAULT_PRACTICE_CASH_E6, formatTokens, formatUsdc, mandateFingerprint, mandateSymbols, mandateToWire, presetMandate } from "@agari/core/desk";
import { encodeBase58 } from "@agari/core/types";
import { deskQueries, getDb, isDbConfigured } from "@agari/db";
import { createRunnerContext } from "../../services/ops/src/actors/desk-runner";
import { feedWarm } from "../../services/ops/src/actors/desk-runner/value";
import { wakeDesk } from "../../services/ops/src/actors/desk-runner/wake";
import { createPreStocksSpotFeed } from "../../services/ops/src/prices/prestocks-spot";
import { arg } from "../deploy/ops-cluster";

const presetId = arg("--preset", "ailabs");
const ownerArg = arg("--owner", "");
const minWarmSec = Number(arg("--min-warm-sec", "40"));
const maxWarmSec = Number(arg("--max-warm-sec", "180"));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const nowSec = () => Math.floor(Date.now() / 1000);
const log = (why: string) => console.log(`  ${why}`);

if (!isDbConfigured()) throw new Error("DATABASE_URL is not set: the drive needs the local Postgres");
const db = getDb()!;
const q = deskQueries(db);

// A. the mandate: the AI Labs preset with the default limits, fingerprinted the way the studio would sign it.
const mandate = presetMandate(presetId);
if (!mandate) throw new Error(`no preset "${presetId}"`);
const fingerprint = mandateFingerprint(mandate);
const owner = ownerArg || encodeBase58(randomBytes(32));
console.log(`desk-practice: preset ${presetId}, owner ${owner} (throwaway), cash $${formatUsdc(DEFAULT_PRACTICE_CASH_E6)}`);
console.log(`  mandate: ${mandate.targets.tokens.map((t) => `${t.symbol} ${t.weightBps} bps`).join(", ")}, cash ${mandate.targets.cashBps} bps; per action $${formatUsdc(mandate.perActionCapE6)}, daily $${formatUsdc(mandate.dailyCapE6)}, premium ceiling ${mandate.maxPremiumBps} bps`);
console.log(`  fingerprint ${fingerprint}`);

// B. the feed, in process, exactly as ops runs it: the runner never fetches PreStocks itself.
const feed = createPreStocksSpotFeed({ log });
feed.start();
const ctx = await createRunnerContext({ log, prestocks: feed });
if (!ctx) throw new Error("the runner could not start (see the lines above)");

// C. the desk row, on the runner's cluster so the runner would find it too.
const desk = await q.createPracticeDesk({ owner, cluster: ctx.env.cluster, mandateBody: mandateToWire(mandate) as unknown as Record<string, unknown>, fingerprint, signer: owner, signature: "drive: unsigned (the studio signs this)", cashE6: DEFAULT_PRACTICE_CASH_E6.toString(), nowSec: nowSec() });
console.log(`  desk ${desk.id} created (${desk.mode}, ${desk.state}, cluster ${desk.cluster})`);

// D. wait for a half-hour mean on every name the mandate names (three reads), at least `minWarmSec` for a steadier one.
const symbols = mandateSymbols(mandate.targets);
const startedSec = nowSec();
for (;;) {
  const elapsed = nowSec() - startedSec;
  if ((elapsed >= minWarmSec && feedWarm(feed, symbols, nowSec())) || elapsed >= maxWarmSec) break;
  await sleep(5_000);
}
const priced = symbols.filter((s) => feed.history(s).length >= 3);
console.log(`  feed warm after ${nowSec() - startedSec} s: ${priced.length}/${symbols.length} names have three reads (${symbols.map((s) => `${s} ${feed.history(s).length}`).join(", ")})`);

// E. one wake, trigger test_read, through the real pipeline.
const wake = await q.claimWake({ deskId: desk.id, scheduledForSec: nowSec(), trigger: "test_read", nowSec: nowSec() });
console.log(`  wake ${wake?.id ?? "(unclaimed)"} test_read`);
const report = await wakeDesk(ctx, { desk, trigger: "test_read", scheduledForSec: nowSec(), wakeId: wake?.id ?? null });
feed.stop();

// F. what was recorded.
console.log(`\nwake ${report.status}${report.note ? `: ${report.note}` : ""}`);
for (const r of report.records) {
  console.log(`  record ${r.seq ?? "(none)"}: ${r.outcome}`);
  console.log(`    summary: ${r.summary}`);
  console.log(`    hash:    ${r.hash ?? "(none)"}`);
  if (r.seq !== null) {
    const stored = await q.getRecord({ deskId: desk.id, seq: r.seq });
    const body = stored?.record.body as { candidate?: { side: string; symbol: string; amountIn: string; amountInUnit: string } | null; timing?: { model: string; latencyMs: number; decision?: { option: string; confidencePercent: number } | null; error: string | null; rejectedByOurChecks: string[] } | null; gate?: { result: string; reasons: string[] } | null; blockers?: { rule: string }[] } | undefined;
    if (body?.candidate) console.log(`    candidate: ${body.candidate.side} ${body.candidate.amountIn} ${body.candidate.amountInUnit} of ${body.candidate.symbol}`);
    if (body?.blockers?.length) console.log(`    blockers: ${body.blockers.map((b) => b.rule).join(", ")}`);
    if (body?.timing) console.log(`    model: ${body.timing.model}, ${body.timing.latencyMs} ms, ${body.timing.decision ? `${body.timing.decision.option} (${body.timing.decision.confidencePercent}%)` : body.timing.error ?? `rejected: ${body.timing.rejectedByOurChecks.join("; ")}`}`);
    if (body?.gate) console.log(`    gate: ${body.gate.result}${body.gate.reasons.length ? ` (${body.gate.reasons.join("; ")})` : ""}`);
    console.log(`    prevHash ${stored?.record.prevHash}`);
  }
}
const paper = await q.getPaper(desk.id);
console.log(`\npaper ledger: cash $${formatUsdc(BigInt(paper?.cashE6 ?? "0"))}${Object.entries(paper?.positions ?? {}).map(([s, raw]) => `, ${s} ${formatTokens(BigInt(raw))} raw-tokens`).join("")}`);
const chain = await q.listRecords({ deskId: desk.id, limit: 10 });
console.log(`records on this desk: ${chain.length} (seq ${chain.map((r) => r.seq).reverse().join(" → ") || "none"})`);
await db.end();
process.exit(0);
