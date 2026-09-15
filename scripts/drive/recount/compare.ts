// recount: the served payloads (`/api/leaderboard` for the venue and each ticker, `/api/traction`) and an exact-integer
// diff against a replay. Every payload must come from the same cached scan (one `computedAtMs`).

import { TICKER_SYMBOLS } from "@agari/core/market";
import type { Recount, RecountSlice } from "./replay";

interface Ranking {
  owner: string;
  pnlBase: string;
  volumeBase: string;
  tradeCount: number;
  settledTrades: number;
  winRatePct: number;
  bestStreak: number;
  roiBps: number | null;
}

interface Meta {
  period: string;
  ticker: string | null;
  session: { date: string; openSec: number; closeSec: number } | null;
  windowStartMs: number;
  windowEndMs: number;
  computedAtMs: number;
  rankedTraders: number;
  totalWallets: number;
  closedCalls: number;
  totalVolumeBase: string;
  complete: boolean;
  decimals: number;
}

interface Traction {
  wallets: number;
  calls: number;
  cashOuts: number;
  stakedBase: string;
  windows: number;
  settledWindows: number;
}

export interface BoardPayload {
  rankings: Ranking[];
  traction: Traction;
  meta: Meta;
}

export interface Served {
  venue: BoardPayload;
  byTicker: Map<string, BoardPayload>;
  /** `/api/traction` (always the 24 h board); null when the recount is of the session board. */
  traction: { traction: Traction; meta: { windowStartMs: number; windowEndMs: number; computedAtMs: number; complete: boolean } } | null;
}

const ATTEMPTS = 4;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(150_000) });
  if (!response.ok) throw new Error(`${url} answered ${response.status}: ${await response.text()}`);
  return (await response.json()) as T;
}

/** Reads every payload; reads again when the cache turned over between requests. */
export async function readServed(web: string, period: "24h" | "session"): Promise<Served> {
  for (let attempt = 1; ; attempt++) {
    const venue = await getJson<BoardPayload>(`${web}/api/leaderboard?period=${period}`);
    const tickers = await Promise.all(TICKER_SYMBOLS.map((t) => getJson<BoardPayload>(`${web}/api/leaderboard?period=${period}&ticker=${t}`)));
    const traction = period === "24h" ? await getJson<NonNullable<Served["traction"]>>(`${web}/api/traction`) : null;
    const stamps = new Set([venue.meta.computedAtMs, ...tickers.map((t) => t.meta.computedAtMs), ...(traction ? [traction.meta.computedAtMs] : [])]);
    if (stamps.size === 1) return { venue, byTicker: new Map(TICKER_SYMBOLS.map((t, i) => [t, tickers[i]!])), traction };
    if (attempt >= ATTEMPTS) throw new Error(`payloads came from ${stamps.size} different scans after ${ATTEMPTS} reads`);
    await sleep(2_000);
  }
}

const rankingKey = (r: { owner: string; pnlBase: bigint | string; volumeBase: bigint | string; tradeCount: number; settledTrades: number; winRatePct: number; bestStreak: number; roiBps: number | null }) =>
  [r.owner, String(r.pnlBase), String(r.volumeBase), r.tradeCount, r.settledTrades, r.winRatePct, r.bestStreak, r.roiBps ?? "null"].join(" ");

function diffSlice(label: string, served: BoardPayload, mine: RecountSlice | undefined, out: string[]): void {
  const expected = mine ?? { rankings: [], rankedTraders: 0, totalWallets: 0, closedCalls: 0, totalVolumeBase: 0n };
  const pairs: [string, string | number, string | number][] = [
    ["rankedTraders", served.meta.rankedTraders, expected.rankedTraders],
    ["totalWallets", served.meta.totalWallets, expected.totalWallets],
    ["closedCalls", served.meta.closedCalls, expected.closedCalls],
    ["totalVolumeBase", served.meta.totalVolumeBase, expected.totalVolumeBase.toString()],
    ["rankings.length", served.rankings.length, expected.rankings.length],
  ];
  for (const [field, a, b] of pairs) if (String(a) !== String(b)) out.push(`${label} ${field}: served ${a} ≠ recount ${b}`);
  const rows = Math.max(served.rankings.length, expected.rankings.length);
  for (let i = 0; i < rows; i++) {
    const a = served.rankings[i] ? rankingKey(served.rankings[i]!) : "(none)";
    const b = expected.rankings[i] ? rankingKey(expected.rankings[i]!) : "(none)";
    if (a !== b) out.push(`${label} rank #${i + 1}:\n      served  ${a}\n      recount ${b}`);
  }
}

function diffTraction(label: string, served: Traction, mine: Recount["traction"], out: string[]): void {
  const fields = ["wallets", "calls", "cashOuts", "stakedBase", "windows", "settledWindows"] as const;
  for (const field of fields) if (String(served[field]) !== String(mine[field])) out.push(`${label} traction.${field}: served ${served[field]} ≠ recount ${mine[field]}`);
}

export function compare(served: Served, recount: Recount, decimals: number): string[] {
  const out: string[] = [];
  const all = [served.venue, ...served.byTicker.values()];
  if (all.some((p) => !p.meta.complete) || (served.traction && !served.traction.meta.complete)) out.push("a served payload says complete: false");
  if (served.venue.meta.decimals !== decimals) out.push(`decimals: served ${served.venue.meta.decimals} ≠ venue ${decimals}`);
  diffSlice("venue", served.venue, recount.venue, out);
  for (const [ticker, payload] of served.byTicker) diffSlice(ticker, payload, recount.byTicker.get(ticker), out);
  diffTraction("leaderboard", served.venue.traction, recount.traction, out);
  if (served.traction) {
    const t = served.traction.meta;
    if (t.windowStartMs !== served.venue.meta.windowStartMs || t.windowEndMs !== served.venue.meta.windowEndMs) out.push("/api/traction covers a different window than /api/leaderboard");
    diffTraction("/api/traction", served.traction.traction, recount.traction, out);
  }
  return out;
}
