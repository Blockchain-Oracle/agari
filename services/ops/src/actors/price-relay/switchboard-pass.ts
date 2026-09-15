/**
 * Switchboard token-lane prints (session-lanes.md §2.4): per T from T + 10 s, one quote for every due close slot, sent as
 * `[quote ix, record]` in parallel; opens copied with `public_copy_open_from_prev`. Lane 6b owns this file. The relay
 * hands it every unexpired Switchboard slot (due or not); missed slots are reported by the relay.
 *
 * Per T: closes print first from one quote over their distinct feeds. Opens then copy the previous Window's close;
 * an open without an adjacent recorded close (the first Window after downtime) prints from the same quote. A slot
 * refused with `QuoteSlotStale` gets one fresh quote while at least 5 s of admission remain. Admission is on the chain
 * clock (`T + 10 ≤ now ≤ T + 60`). Every quote attempt is reported to halt-watch (`recordQuoteResult`): a fetched quote
 * resets its xStocks' streaks, a failed fetch or a `QuoteSlotStale` refusal adds one, and three in a row halt the lane.
 */
import { readFileSync } from "node:fs";
import {
  copyOpenSlot, fetchTokenQuote, inBatches, quoteHasFeed, readSwitchboardVenue, recordSwitchboardSlot, SWITCHBOARD_ERROR,
  type PrintSlot, type SlotOutcome, type SwitchboardVenue,
} from "@agari/markets/ops/prints";
import type { SwitchboardQuote } from "@agari/markets/prices/legacy";
import type { XStockSymbol } from "@agari/core/market";
import { errorText } from "../../runtime/env";
import { recordQuoteResult } from "../halt-watch/quote-failures";
import type { LanePassResult } from "./lane-pass";
import type { RelayContext } from "./relay-pass";

const CONCURRENCY = 4;
const VENUE_TTL_MS = 5 * 60_000;
const RETRY_MIN_LEFT_SEC = 5;
const MAX_ATTEMPTS = 3;
const CONFIG_URL = new URL("../../../config/price-sources.json", import.meta.url);

type TokenLaneFile = { tokenLane?: { tickers?: Record<string, { surgeSymbol: string; feedHash: string | null }> } };

export type TokenFeed = { xstock: XStockSymbol; surgeSymbol: string };

/** Pinned feed hash → its xStock and Surge symbol (`price-sources.json` `tokenLane`). */
export function tokenFeedsByHash(text = readFileSync(CONFIG_URL, "utf8")): Map<string, TokenFeed> {
  const tickers = (JSON.parse(text) as TokenLaneFile).tokenLane?.tickers ?? {};
  return new Map(
    Object.entries(tickers).flatMap(([xstock, t]) => (t.feedHash ? [[t.feedHash.toLowerCase(), { xstock: xstock as XStockSymbol, surgeSymbol: t.surgeSymbol }] as const] : [])),
  );
}

type LaneState = { venue: SwitchboardVenue | null; venueAtMs: number; feeds: Map<string, TokenFeed>; retried: Set<number> };
const states = new WeakMap<RelayContext, LaneState>();

function stateOf(ctx: RelayContext): LaneState {
  let s = states.get(ctx);
  if (!s) states.set(ctx, (s = { venue: null, venueAtMs: 0, feeds: tokenFeedsByHash(), retried: new Set() }));
  return s;
}

/** The relay's slot key (`relay-pass.ts`), repeated here so the lane imports only its types. */
const slotKey = (s: PrintSlot) => `${s.market}:${s.slot}`;
const iso = (sec: number) => new Date(sec * 1000).toISOString().slice(11, 19) + "Z";
const short = (s: PrintSlot) => `${s.seriesKey}#${s.marketIndex} ${s.slot}`;

function account(ctx: RelayContext, outcomes: SlotOutcome[]): string[] {
  return outcomes.map((o) => {
    const key = slotKey(o.slot);
    if (o.status === "recorded") {
      ctx.counters.recorded++;
      ctx.failures.delete(key);
      return `${short(o.slot)} ✓ ${o.signature!.slice(0, 8)}`;
    }
    if (o.status === "already") return (ctx.counters.already++, `${short(o.slot)} already`);
    if (o.status === "early") return `${short(o.slot)} too early (chain clock)`;
    const prev = ctx.failures.get(key)?.attempts ?? 0;
    ctx.failures.set(key, { attempts: prev + 1, reason: `switchboard ${o.status}: ${o.error ?? ""}`.slice(0, 300) });
    ctx.counters.failed++;
    return `${short(o.slot)} ${o.status} (${o.code ?? "no code"})`;
  });
}

async function boundary(ctx: RelayContext, state: LaneState, queue: string, tSec: number, slots: PrintSlot[], chainNow: number): Promise<string> {
  const minOracles = state.venue!.minOracles;
  const closes = slots.filter((s) => s.slot === "close");
  const opens = slots.filter((s) => s.slot === "open");
  const unknown = slots.filter((s) => !state.feeds.has(s.feedIdHex));
  if (unknown.length) return `switchboard T ${iso(tSec)}: no Surge symbol pinned for ${unknown.map(short).join(", ")}`;
  const symbolsOf = (list: PrintSlot[]) => [...new Set(list.map((s) => state.feeds.get(s.feedIdHex)!.surgeSymbol))];
  const xstocksOf = (list: PrintSlot[]) => [...new Set(list.map((s) => state.feeds.get(s.feedIdHex)!.xstock))];
  if (ctx.dryRun) return `DRY switchboard T ${iso(tSec)}: would quote ${symbolsOf(slots).join(",")} (≥ ${minOracles} oracles), print ${closes.map(short).join(", ") || "no close"}, copy ${opens.map(short).join(", ") || "no open"}`;

  const quoteFor = async (list: PrintSlot[]) => {
    try {
      const fetched = await fetchTokenQuote({ rpcUrl: ctx.rpcUrl, surgeSymbols: symbolsOf(list), minOracles, queue });
      recordQuoteResult(xstocksOf(list), true);
      return fetched;
    } catch (error) {
      recordQuoteResult(xstocksOf(list), false);
      throw error;
    }
  };
  let quote: SwitchboardQuote | null = null;
  const lines: string[] = [];
  const print = async (list: PrintSlot[]): Promise<SlotOutcome[]> => {
    if (list.length === 0) return [];
    if (!quote || list.some((s) => !quoteHasFeed(quote!, s.feedIdHex))) quote = await quoteFor(slots);
    let outcomes = await inBatches(list, CONCURRENCY, (s) => recordSwitchboardSlot(ctx.client, s, quote!, queue));
    const stale = outcomes.filter((o) => o.code === SWITCHBOARD_ERROR.quoteSlotStale).map((o) => o.slot);
    if (stale.length) recordQuoteResult(xstocksOf(stale), false);
    if (stale.length && !state.retried.has(tSec) && Math.min(...stale.map((s) => s.deadlineSec)) - chainNow >= RETRY_MIN_LEFT_SEC) {
      state.retried.add(tSec);
      quote = await quoteFor(slots);
      const again = await inBatches(stale, CONCURRENCY, (s) => recordSwitchboardSlot(ctx.client, s, quote!, queue));
      outcomes = [...outcomes.filter((o) => o.code !== SWITCHBOARD_ERROR.quoteSlotStale), ...again];
      lines.push(`retried ${stale.length} stale`);
    }
    return outcomes;
  };
  try {
    const closed = await print(closes);
    const copied = await inBatches(opens, CONCURRENCY, (s) => copyOpenSlot(ctx.client, s));
    const noPrev = (o: SlotOutcome) => o.code === SWITCHBOARD_ERROR.printNotAdjacent || o.code === SWITCHBOARD_ERROR.printsMissing;
    const direct = await print(copied.filter(noPrev).map((o) => o.slot));
    const outcomes = [...closed, ...copied.filter((o) => !noPrev(o)), ...direct];
    const q = quote as SwitchboardQuote | null;
    const signed = q ? ` · slot ${q.slot} oracles [${q.oracleIdxs.join(",")}]` : "";
    return `switchboard T ${iso(tSec)}${signed}: ${[...account(ctx, outcomes), ...lines].join(", ")}`;
  } catch (error) {
    for (const slot of slots) {
      const prev = ctx.failures.get(slotKey(slot))?.attempts ?? 0;
      ctx.failures.set(slotKey(slot), { attempts: prev + 1, reason: `quote failed: ${errorText(error)}`.slice(0, 300) });
    }
    ctx.counters.failed += slots.length;
    return `switchboard T ${iso(tSec)}: quote failed: ${errorText(error).slice(0, 200)}`;
  }
}

export async function switchboardPass(ctx: RelayContext, slots: readonly PrintSlot[], chainNow: number): Promise<LanePassResult> {
  if (slots.length === 0) return { line: null, nextSec: null };
  const state = stateOf(ctx);
  if (!state.venue || Date.now() - state.venueAtMs > VENUE_TTL_MS) {
    state.venue = await readSwitchboardVenue(ctx.client);
    state.venueAtMs = Date.now();
  }
  const queue = state.venue.queue;
  if (!queue) return { line: `switchboard: ${slots.length} slot(s), no queue pinned in GlobalConfig (admin_set_authorities)`, nextSec: null };

  const lagSec = Math.floor(Date.now() / 1000) - chainNow;
  const usable = slots.filter((s) => (ctx.failures.get(slotKey(s))?.attempts ?? 0) < MAX_ATTEMPTS);
  const due = usable.filter((s) => chainNow >= s.earliestSec);
  const pending = usable.filter((s) => chainNow < s.earliestSec);
  const byT = new Map<number, PrintSlot[]>();
  for (const s of due) byT.set(s.boundarySec, [...(byT.get(s.boundarySec) ?? []), s]);
  const lines: string[] = [];
  for (const [tSec, list] of [...byT].sort((a, b) => a[0] - b[0])) lines.push(await boundary(ctx, state, queue, tSec, list, chainNow));
  for (const t of state.retried) if (t < chainNow - 3_600) state.retried.delete(t);
  const gaveUp = slots.length - usable.length;
  if (gaveUp) lines.push(`switchboard: ${gaveUp} slot(s) past ${MAX_ATTEMPTS} attempts (reported missed at their deadline)`);
  const nextSec = pending.length ? Math.min(...pending.map((s) => s.earliestSec)) + lagSec : null;
  return { line: lines.length ? lines.join(" | ") : null, nextSec };
}
