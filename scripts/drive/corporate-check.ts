#!/usr/bin/env -S pnpm exec tsx
// S6 corporate-action proposer (session-lanes.md §3.4, D-057): prints `corporate-actions.json` entries for a person to
// review and commit. It NEVER writes the file. Reads (no chain, no signing):
// - xStocks `GET /public/assets/<SYM>x/multiplier?network=Solana` for every registry ticker (keyless): a pending
//   `newMultiplier` becomes a `multipliers[]` entry for the token lane's xStocks, and a split-like reason also
//   becomes a `skips[]` entry for the underlying on the activation's ET date (Regular and Gap lanes);
// - Finnhub `GET /stock/split` (header key) for every registry ticker, 3 s apart. The free key answers 403
//   (probed 2026-09-15), so one refusal ends that source for the run and says so.
// Decimals stay the issuer's exact JSON text (never parsed to a float). Keys are presence-only in the output.
// Run: pnpm exec tsx --env-file-if-exists=.env.local scripts/drive/corporate-check.ts [--days 60] [--no-finnhub]

import { readFileSync } from "node:fs";
import { addDays, etDateOf, TICKER_SYMBOLS, TICKERS, XSTOCK_SYMBOLS, type TickerSymbol } from "@agari/core/market";
import type { CorporateSkip, MultiplierChange } from "@agari/core/types";
import { arg, flag } from "../deploy/ops-cluster";

const FILE = new URL("../../services/ops/config/corporate-actions.json", import.meta.url);
const XSTOCKS = "https://api.xstocks.fi/api/v2/public/assets";
const FINNHUB = "https://finnhub.io/api/v1/stock/split";
const DECIMAL = /^\d+(\.\d+)?$/;
const days = Number(arg("--days", "60"));
const nowSec = Math.floor(Date.now() / 1000);
const today = etDateOf(nowSec);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Current = { skips?: CorporateSkip[]; multipliers?: MultiplierChange[] };
const current = JSON.parse(readFileSync(FILE, "utf8")) as Current;
const proposedSkips: CorporateSkip[] = [];
const proposedMultipliers: MultiplierChange[] = [];
const notes: string[] = [];

/** The raw JSON number text of `field` (exact, e.g. `1.0017152487959897`), or null. */
const numberText = (body: string, field: string) => new RegExp(`"${field}"\\s*:\\s*(-?[\\d.]+(?:[eE][-+]?\\d+)?)`).exec(body)?.[1] ?? null;

function activationSec(body: string): number | null {
  const iso = /"activationDateTime"\s*:\s*"([^"]+)"/.exec(body)?.[1];
  if (iso) return Number.isFinite(Date.parse(iso)) ? Math.floor(Date.parse(iso) / 1000) : null;
  const n = Number(numberText(body, "activationDateTime") ?? "0");
  if (!n) return null;
  return n > 1e12 ? Math.floor(n / 1000) : n;
}

async function xstocksMultiplier(symbol: TickerSymbol): Promise<void> {
  const xstock = TICKERS[symbol].xstock?.symbol ?? `${symbol}x`;
  const res = await fetch(`${XSTOCKS}/${xstock}/multiplier?network=Solana`, { signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (!res?.ok) return void notes.push(`xStocks ${xstock}: ${res ? `HTTP ${res.status}` : "unreachable"} (no xStock or no data)`);
  const body = await res.text();
  const [from, to, reason] = [numberText(body, "currentMultiplier"), numberText(body, "newMultiplier"), /"reason"\s*:\s*"([^"]*)"/.exec(body)?.[1] ?? null];
  const effectiveSec = activationSec(body);
  if (!to || to === "0" || effectiveSec === null) return void notes.push(`xStocks ${xstock}: multiplier ${from ?? "?"}, nothing pending`);
  if (effectiveSec < nowSec - 3 * 86_400) return void notes.push(`xStocks ${xstock}: last change ${new Date(effectiveSec * 1000).toISOString()} already applied`);
  const why = `${xstock} ${reason ?? "multiplier change"} ${from} → ${to} (xStocks)`;
  if (!from || !DECIMAL.test(from) || !DECIMAL.test(to)) notes.push(`xStocks ${xstock}: multiplier text "${from}" → "${to}" is not a plain decimal; write the entry by hand`);
  else if ((XSTOCK_SYMBOLS as readonly string[]).includes(xstock)) proposedMultipliers.push({ xstock: xstock as MultiplierChange["xstock"], effectiveSec, from, to, why });
  if (/split/i.test(reason ?? "")) proposedSkips.push({ symbol, date: etDateOf(effectiveSec), why, lanes: ["regular", "gap"] });
}

async function finnhubSplits(symbols: readonly TickerSymbol[]): Promise<void> {
  const key = process.env.FINNHUB_API_KEY?.trim();
  if (!key) return void notes.push("Finnhub: FINNHUB_API_KEY missing, skipped");
  const range = { from: addDays(today, -3), to: addDays(today, days) };
  for (const [i, symbol] of symbols.entries()) {
    if (i > 0) await sleep(3_000);
    const res = await fetch(`${FINNHUB}?${new URLSearchParams({ symbol, ...range })}`, { headers: { "X-Finnhub-Token": key }, signal: AbortSignal.timeout(10_000) }).catch(() => null);
    if (res?.status === 403 || res?.status === 401) return void notes.push(`Finnhub /stock/split: HTTP ${res.status} on this key (not in the free tier); split skips come from xStocks reasons only`);
    if (!res?.ok) return void notes.push(`Finnhub /stock/split ${symbol}: ${res ? `HTTP ${res.status}` : "unreachable"}; stopped`);
    const rows = (await res.json()) as Array<{ symbol?: string; date?: string; fromFactor?: number; toFactor?: number }>;
    for (const row of Array.isArray(rows) ? rows : []) {
      if (row.symbol !== symbol || !row.date || !/^\d{4}-\d{2}-\d{2}$/.test(row.date)) continue;
      proposedSkips.push({ symbol, date: row.date, why: `${row.toFactor}-for-${row.fromFactor} split (Finnhub)` });
    }
  }
}

for (const symbol of TICKER_SYMBOLS) await xstocksMultiplier(symbol);
if (!flag("--no-finnhub")) await finnhubSplits(TICKER_SYMBOLS);

const known = (s: CorporateSkip) => (current.skips ?? []).some((k) => k.symbol === s.symbol && k.date === s.date);
const knownM = (m: MultiplierChange) => (current.multipliers ?? []).some((k) => k.xstock === m.xstock && k.effectiveSec === m.effectiveSec);
const skips = proposedSkips.filter((s) => !known(s));
const multipliers = proposedMultipliers.filter((m) => !knownM(m));

console.log(`corporate-check at ${new Date(nowSec * 1000).toISOString()} (ET ${today}, +${days} days); FINNHUB_API_KEY present: ${Boolean(process.env.FINNHUB_API_KEY)}`);
for (const note of notes) console.log(`  - ${note}`);
console.log(`already in corporate-actions.json: ${proposedSkips.length - skips.length} skip(s), ${proposedMultipliers.length - multipliers.length} multiplier(s)`);
if (skips.length === 0 && multipliers.length === 0) console.log("nothing to propose");
else console.log(`proposed additions (review, then add by hand to services/ops/config/corporate-actions.json):\n${JSON.stringify({ skips, multipliers }, null, 2)}`);
