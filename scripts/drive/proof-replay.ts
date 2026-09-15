#!/usr/bin/env -S pnpm exec tsx
// proof-replay (S5 §2.6): re-post the archived signed Pyth update behind a recorded print to the receiver as
// `proof-replay`, read the PriceUpdateV2 back, check it in integers against the print, store the decode in print_proofs.
// Run:  pnpm drive:proof-replay --market <id> [--which 1]
//       pnpm drive:proof-replay --symbol TSLA --at 2026-09-14T20:00:00Z
//       pnpm drive:proof-replay --session 2026-09-14 [--limit 20]
//       pnpm drive:proof-replay --close-older-than 86400          (alone, or after a replay)
// Opts: --rpc <url> (a Surfpool fork: http://127.0.0.1:8980), --json.
// Env:  DATABASE_URL, PROOF_REPLAY_PRIVATE_KEY or ~/.config/agari/devnet/proof-replay.json, PROOF_REPLAY_RPC_URL.
// `proofStore` is imported by path, like verify-index: the lane file is not re-exported from `@agari/db` yet.
import { etDateOf, etWallToUtcSec, formatEtClock, TICKER_SYMBOLS } from "@agari/core/market";
import { getDb } from "@agari/db";
import {
  balanceLamports,
  closeProofAccounts,
  keypairAddress,
  proofReplayRpcUrl,
  proofReplaySecret,
  pythFeedOf,
  replayPythProof,
  type ProofStore,
  type ReplayOutcome,
} from "@agari/markets/proof";
import { proofStore } from "../../packages/db/src/proofs";

const MIN_PAYER_LAMPORTS = 20_000_000n;
const argv = process.argv.slice(2);
const arg = (name: string): string | null => (argv.includes(name) ? (argv[argv.indexOf(name) + 1] ?? null) : null);
const json = argv.includes("--json");
const log = (line: string) => void (json ? undefined : console.log(line));

const secret = proofReplaySecret(process.env);
if (!secret) throw new Error("no proof-replay key: set PROOF_REPLAY_PRIVATE_KEY or create ~/.config/agari/devnet/proof-replay.json");
const sql = getDb();
if (!sql) throw new Error("DATABASE_URL is not set");
const rpcUrl = arg("--rpc") ?? proofReplayRpcUrl(process.env);
const redact = (text: string) => text.replace(/\b(?:https?|wss?):\/\/\S+/g, (url) => (url.startsWith("http://127.0.0.1") ? url : "<rpc>"));
const payer = keypairAddress(secret);
const store = proofStore(sql) as ProofStore;

type Target = { market: string; which: number; symbol: string; boundarySec: number };

async function targets(): Promise<Target[]> {
  const market = arg("--market");
  if (market) {
    const which = Number(arg("--which") ?? 1);
    const rows = await sql!<Array<{ symbol: string; t: string }>>`
      SELECT m.symbol, p.source_ts_sec::text AS t FROM idx_prints p JOIN idx_markets m USING (market) WHERE p.market = ${market} AND p.which = ${which}`;
    return rows.map((r) => ({ market, which, symbol: r.symbol, boundarySec: Number(r.t) }));
  }
  const symbol = arg("--symbol");
  const at = arg("--at");
  if (symbol && at) {
    if (!(TICKER_SYMBOLS as readonly string[]).includes(symbol)) throw new Error(`unknown symbol ${symbol}`);
    const boundarySec = Math.floor(Date.parse(at) / 1000);
    if (!Number.isFinite(boundarySec)) throw new Error(`--at ${at} is not an ISO time`);
    return pythPrints(sql!`AND m.symbol = ${symbol} AND p.source_ts_sec = ${boundarySec}`, 1);
  }
  const session = arg("--session");
  if (session) {
    const fromSec = etWallToUtcSec(session, 9 * 60 + 30);
    return pythPrints(sql!`AND p.source_ts_sec BETWEEN ${fromSec} AND ${fromSec + 7 * 3_600}`, Number(arg("--limit") ?? 20));
  }
  return [];
}

/** One (market, which) per boundary: one post proves every trial feed at T. Close prints first, the newest Window. */
async function pythPrints(filter: ReturnType<NonNullable<typeof sql>["unsafe"]>, limit: number): Promise<Target[]> {
  const rows = await sql!<Array<{ market: string; which: number; symbol: string; t: string }>>`
    SELECT DISTINCT ON (p.source_ts_sec) p.market, p.which, m.symbol, p.source_ts_sec::text AS t
    FROM idx_prints p JOIN idx_markets m USING (market)
    WHERE p.source = 1 ${filter}
    ORDER BY p.source_ts_sec, p.which DESC, m.expiry_sec DESC`;
  return rows.slice(0, limit).map((r) => ({ market: r.market, which: r.which, symbol: r.symbol, boundarySec: Number(r.t) }));
}

function describe(outcome: ReplayOutcome): string {
  switch (outcome.kind) {
    case "verified":
      return outcome.rows
        .map((r) => `  ${r.feed.slice(0, 8)}… ${r.priceUpdate} ${r.verification} price ${r.price}e${r.expo} conf ${r.conf} publish ${r.publishTimeSec} slot ${r.postedSlot}`)
        .concat(`  post signatures: ${outcome.rows[0]?.postSignatures.join(" ")}`)
        .join("\n");
    case "refused":
      return `  refused: ${JSON.stringify(outcome.refusal, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`;
    case "failed":
      return `  failed: ${redact(outcome.error)}`;
    default:
      return `  ${outcome.kind} at ${outcome.boundarySec}`;
  }
}

const results: Array<Target & { outcome: ReplayOutcome }> = [];
try {
  const list = await targets();
  const closeAfter = arg("--close-older-than");
  if (list.length === 0 && closeAfter === null) throw new Error("nothing to do: pass --market, --symbol with --at, --session or --close-older-than");
  log(`proof-replay payer ${payer} on ${redact(rpcUrl)}`);
  for (const target of list) {
    const lamports = await balanceLamports(rpcUrl, payer);
    if (lamports < MIN_PAYER_LAMPORTS) throw new Error(`payer balance ${lamports} lamports is below ${MIN_PAYER_LAMPORTS}; fund ${payer}`);
    log(`\n${target.symbol} ${etDateOf(target.boundarySec)} ${formatEtClock(target.boundarySec)} ET (T=${target.boundarySec}) market ${target.market} which ${target.which} feed ${pythFeedOf(target.symbol)?.slice(0, 8)}…`);
    const outcome = await replayPythProof({ store, rpcUrl, payerSecret: secret }, { market: target.market, which: target.which });
    results.push({ ...target, outcome });
    log(describe(outcome));
  }
  let closeReport = null;
  if (closeAfter !== null) {
    closeReport = await closeProofAccounts({ store, rpcUrl, payerSecret: secret }, Number(closeAfter));
    log(`\nclose (older than ${closeAfter} s): ${closeReport.closed.length} boundary(ies)`);
    for (const c of closeReport.closed) log(`  T=${c.boundarySec} ${c.addresses.join(" ")} → ${c.signatures.join(" ")}`);
    if (closeReport.orphans.addresses.length > 0) log(`  orphans ${closeReport.orphans.addresses.join(" ")} → ${closeReport.orphans.signatures.join(" ")}`);
    if (closeReport.skippedOrphans) log(`  orphan sweep skipped: ${closeReport.skippedOrphans}`);
    for (const e of closeReport.errors) log(`  error ${redact(e)}`);
  }
  if (json) console.log(JSON.stringify({ payer, results, close: closeReport }, (_k, v) => (typeof v === "bigint" ? v.toString() : v), 2));
  const bad = results.some((r) => r.outcome.kind === "failed" || r.outcome.kind === "refused") || (closeReport?.errors.length ?? 0) > 0;
  process.exitCode = bad ? 1 : 0;
} catch (error) {
  console.error(redact(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 2 });
  // web3.js keeps its confirmation websocket open.
  setTimeout(() => process.exit(), 200).unref();
}
