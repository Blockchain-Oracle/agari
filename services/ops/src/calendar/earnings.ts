/**
 * The earnings calendar (session-lanes.md §3.3, D-057): Finnhub `/calendar/earnings` for the seven registry stocks
 * (ETFs never report), 14 days ahead, once per 6 h, into `deps.events.setEarnings`. `/session.earnings` stays null
 * ("unknown", never "none") until every stock was read in one round; a failed round keeps the last good calendar.
 *
 * - **One call per stock:** the unfiltered calendar caps at 1,500 rows and drops the earliest dates in reporting season
 *   (S13c probe, 2026-09-15), so a missing TSLA row would read as "no report".
 * - **Shared key budget:** the free key allows 60 calls/min and the web keeps to 10 (S13c `finnhub.server.ts`); ops
 *   spends 7 calls per 6 h, 3 s apart, and stops a round on HTTP 429.
 * - **Key:** `FINNHUB_API_KEY` is sent only as the `X-Finnhub-Token` header, never in a URL or a log line.
 * S13 owns the web client and `/api/earnings` (D-071); this is the ops read that serves the flags.
 */
import { EARNINGS_SYMBOLS, earningsRange, parseFinnhubEarnings, type TickerSymbol } from "@agari/core/market";
import type { EarningsEvent } from "@agari/core/types";
import { errorText, runActor, type VenueDeps } from "../runtime";

const PASS_MS = 6 * 60 * 60_000;
const RETRY_MS = 15 * 60_000;
const CALL_GAP_MS = 3_000;
const TIMEOUT_MS = 8_000;
const BASE_URL = "https://finnhub.io/api/v1/calendar/earnings";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Read = { ok: true; events: EarningsEvent[] } | { ok: false; why: string; limited: boolean };

async function readSymbol(symbol: TickerSymbol, from: string, to: string, key: string): Promise<Read> {
  const url = `${BASE_URL}?${new URLSearchParams({ symbol, from, to })}`;
  try {
    const res = await fetch(url, { headers: { "X-Finnhub-Token": key }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return { ok: false, why: `${symbol} HTTP ${res.status}`, limited: res.status === 429 };
    const events = parseFinnhubEarnings(await res.json(), [symbol]);
    return events ? { ok: true, events } : { ok: false, why: `${symbol} unexpected body`, limited: false };
  } catch (error) {
    return { ok: false, why: `${symbol} ${errorText(error)}`, limited: false };
  }
}

const describe = (e: EarningsEvent) => `${e.symbol} ${e.dateEt.slice(5)}${e.hour ? ` ${e.hour}` : ""}`;

export async function startEarnings(deps: VenueDeps): Promise<{ stop: () => void }> {
  const pass = async () => {
    const key = process.env.FINNHUB_API_KEY?.trim();
    if (!key) return { why: "paused: FINNHUB_API_KEY missing (earnings unknown)" };
    const { from, to } = earningsRange(Math.floor(Date.now() / 1000));
    const events: EarningsEvent[] = [];
    const failures: string[] = [];
    for (const [i, symbol] of EARNINGS_SYMBOLS.entries()) {
      if (i > 0) await sleep(CALL_GAP_MS);
      const read = await readSymbol(symbol, from, to, key);
      if (read.ok) events.push(...read.events);
      else failures.push(read.why);
      if (!read.ok && read.limited) break;
    }
    const kept = deps.events.earnings();
    if (failures.length > 0) {
      const state = kept === null ? "earnings stay unknown" : `keeping the last calendar (${kept.length} reports)`;
      return { why: `earnings ${from}..${to}: read failed (${failures.join(", ")}); ${state}; retry in 15 min`, nextDelayMs: RETRY_MS, detail: { from, to, failures } };
    }
    events.sort((a, b) => a.dateEt.localeCompare(b.dateEt) || a.symbol.localeCompare(b.symbol));
    deps.events.setEarnings(events);
    const list = events.length ? events.map(describe).join(", ") : "none";
    return { why: `earnings ${from}..${to}: ${events.length} report(s) for ${EARNINGS_SYMBOLS.length} stocks: ${list}`, detail: { from, to, events } };
  };
  const { stop } = runActor({ name: "earnings", log: deps.log, dryRun: false, everyMs: PASS_MS, pass });
  return { stop };
}
