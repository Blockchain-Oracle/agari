#!/usr/bin/env -S pnpm exec tsx
// recount (S5 gate, proof-analytics.md §2.4): recomputes the leaderboard (the venue and every ticker) and traction
// independently and diffs them against what the web serves, with exact integers. Exit 1 on any mismatch.
//   --source chain (default): walk agari-events signatures and decode each transaction afresh (paced, ≈ 25 min/session
//     at 3 RPS); --source events: replay idx_events (fast, trusts ingestion, never reads the projections).
// Run:  pnpm drive:recount --web http://localhost:3052 [--period 24h|session] [--source chain|events] [--rps 3] [--rpc URL]
// Env:  DATABASE_URL (events), HELIUS_API_KEY (only with --rpc helius), AGARI_OPERATOR_WALLETS (else the maker and
//       settler role keys in ~/.config/agari/devnet, the same list the board excludes).

import { readFileSync } from "node:fs";
import { keypairAddress } from "@agari/markets";
import { ensureRole } from "../deploy/roles.mjs";
import { compare, readServed } from "./recount/compare";
import type { Tape } from "./recount/facts";
import { replay } from "./recount/replay";
import { chainTape } from "./recount/source-chain";
import { eventsTape } from "./recount/source-events";

const arg = (name: string, fallback: string) => (process.argv.includes(name) ? process.argv[process.argv.indexOf(name) + 1]! : fallback);
const web = arg("--web", "http://localhost:3052").replace(/\/$/, "");
const period = arg("--period", "24h");
const source = arg("--source", "chain");
const rps = Number(arg("--rps", "3"));
if (period !== "24h" && period !== "session") throw new Error("--period must be 24h or session");
if (source !== "chain" && source !== "events") throw new Error("--source must be chain or events");

const DAY_MS = 86_400_000;
const LONGEST_CADENCE_SEC = 3_600;
const TOP = 50;
const helius = process.env.HELIUS_API_KEY;
const redact = (text: string) => (helius ? text.replaceAll(helius, "<HELIUS_API_KEY>") : text);
const rpcArg = arg("--rpc", "https://api.devnet.solana.com");
const rpcUrl = rpcArg === "helius" ? `https://devnet.helius-rpc.com/?api-key=${helius ?? ""}` : rpcArg;

function operators(): Set<string> {
  const listed = (process.env.AGARI_OPERATOR_WALLETS ?? "").split(",").map((w) => w.trim()).filter(Boolean);
  if (listed.length > 0) return new Set(listed);
  const roleAddress = (role: string) => keypairAddress(Uint8Array.from(JSON.parse(readFileSync(ensureRole(role).path, "utf8")) as number[]));
  return new Set([roleAddress("maker"), roleAddress("settler")]);
}

try {
  const decimals = (JSON.parse(readFileSync("scripts/deploy/addresses.devnet.json", "utf8")) as { venue: { collateralDecimals: number } }).venue.collateralDecimals;
  const excluded = operators();
  const served = await readServed(web, period);
  const meta = served.venue.meta;
  const lookbackSec = period === "24h" ? Math.floor((meta.windowEndMs - 2 * DAY_MS) / 1000) : meta.session!.openSec - LONGEST_CADENCE_SEC;
  console.log(`recount ${period} via ${source}: window [${new Date(meta.windowStartMs).toISOString()}, ${new Date(meta.windowEndMs).toISOString()}), lookback ${new Date(lookbackSec * 1000).toISOString()}`);
  console.log(`  served scan computed ${new Date(meta.computedAtMs).toISOString()}${meta.session ? `, session ${meta.session.date}` : ""}; operators excluded: ${[...excluded].join(", ")}`);

  const tape: Tape =
    source === "events"
      ? await eventsTape(lookbackSec - 900)
      : await chainTape({ rpcUrl, rps, fromSec: Math.ceil(meta.windowStartMs / 1000), toSec: Math.ceil(meta.windowEndMs / 1000), lookbackSec, log: (line) => console.log(redact(line)) });
  for (const note of tape.notes) console.log(`  ${redact(note)}`);

  const recount = replay(tape, { windowStartMs: meta.windowStartMs, windowEndMs: meta.windowEndMs, lookbackSec, top: TOP, decimals, operators: excluded });
  const t = recount.traction;
  console.log(`  in scope: ${recount.counts.windows} Windows, ${recount.counts.fills} fills, ${recount.counts.sets} complete sets, ${recount.counts.wallets} wallets`);
  console.log(`  venue: ${recount.venue.rankedTraders} ranked, ${recount.venue.closedCalls} closed calls, volume ${recount.venue.totalVolumeBase} base`);
  for (const [ticker, slice] of recount.byTicker) console.log(`  ${ticker.padEnd(5)}: ${slice.rankedTraders} ranked, ${slice.closedCalls} closed calls, volume ${slice.totalVolumeBase} base`);
  console.log(`  traction: wallets ${t.wallets} · calls ${t.calls} · cashOuts ${t.cashOuts} · staked ${t.stakedBase} base · windows ${t.windows} · settled ${t.settledWindows}`);

  const mismatches = [...tape.problems, ...compare(served, recount, decimals)];
  console.log(mismatches.length === 0 ? "recount: OK — every ranking and traction figure matches exactly" : `recount: MISMATCH\n  - ${mismatches.map(redact).join("\n  - ")}`);
  process.exitCode = mismatches.length === 0 ? 0 : 1;
} catch (error) {
  console.error(redact(error instanceof Error ? (error.stack ?? error.message) : String(error)));
  process.exitCode = 1;
}
