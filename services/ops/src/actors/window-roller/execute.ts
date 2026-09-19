/**
 * One roller pass (venue-ops.md §5): read the registry Series of every known basis and their unreleased Markets on the
 * chain clock, recycle Books of locked or terminal Windows, grow crowded Ledgers, then open each Series' planned Window
 * (Regular, Gap and token plans by basis, session-lanes.md §6). Every send is preceded by a fresh read; "already done"
 * engine codes are treated as done.
 */
import {
  chainNowSec, ENGINE_ERROR, fetchMarkets, fetchSeries, listMarketsOfSeries, listSeries, MARKET_FLAG, marketStatus, OpsSendError, windowAddresses,
  seriesBasis, seriesLaneKey, type MarketView, type OpsClient, type SeriesView,
} from "@agari/markets/ops";
import { fetchBookHeaders, fetchLedgerHeaders, growLedger, openWindow, releaseBook, sweepBook, type VenueConfig } from "@agari/markets/ops/roller";
import { laneListable } from "@agari/core/market";
import type { PassResult } from "../../runtime/actor";
import type { VenueDeps } from "../../runtime/deps";
import { errorText } from "../../runtime/env";
import { spanOf, type PlanClock, type SeriesPlan } from "./plan";
import { planByBasis } from "./plan-basis";
import { gapSpanOf } from "./plan-gap";
import { describeVersion, versionWindow } from "./versions";

export interface RollerSettings {
  leadSec: number;
  gapLeadSec: number;
  minTradableSec: number;
  /** Prelist the next session's first Regular Window at the previous close (D-089). */
  prelist: boolean;
  prelistCadencesSec: readonly number[];
  /** Optional `TSLA-5m,TSLA-gap,TSLAx-5m` filter (dev runs); empty = every Series of a registry ticker. */
  only: readonly string[];
}

export interface RollerState {
  client: OpsClient;
  config: VenueConfig;
  settings: RollerSettings;
  dryRun: boolean;
  series: SeriesView[];
  seriesListedMs: number;
  /** Per Series: the lowest index whose Book may still be bound. */
  lowIndex: Map<string, bigint>;
  counters: { opened: number; swept: number; released: number; grown: number; failed: number };
}

const SERIES_LIST_MS = 5 * 60_000;
const GROW_HEADROOM = 8;
const GROW_SEATS = 96;
const LEDGER_MAX_SEATS = 1_024;
const SWEEPS_PER_BOOK = 8;

export const seriesKey = seriesLaneKey;
/** A Gap spans days, so its log span carries dates (`09-18 20:00Z–09-21 13:30Z`). */
const spanFor = (s: SeriesView, w: { tradingStartSec: number; expirySec: number }) => (seriesBasis(s) === "gap" ? gapSpanOf(w) : spanOf(w));
/** Lamports as an exact SOL string with three decimals (display only). */
const solText = (lamports: bigint) => `${lamports / 1_000_000_000n}.${(lamports % 1_000_000_000n).toString().padStart(9, "0").slice(0, 3)}`;

async function refreshSeries(state: RollerState): Promise<void> {
  if (Date.now() - state.seriesListedMs >= SERIES_LIST_MS) {
    // D-103: a pre-IPO name lists only on the 24/7 lane; its drive-only Regular Series must never roll on the NYSE clock.
    const listed = (await listSeries(state.client)).filter((s) => s.symbol !== null && seriesBasis(s) !== null && laneListable(s.symbol, seriesBasis(s)!));
    state.series = state.settings.only.length ? listed.filter((s) => state.settings.only.includes(seriesKey(s))) : listed;
    state.seriesListedMs = Date.now();
    for (const s of state.series) {
      if (state.lowIndex.has(s.address)) continue;
      const markets = await listMarketsOfSeries(state.client, s.address);
      const bound = markets.find((m) => (m.data.flags & MARKET_FLAG.bookReleased) === 0);
      state.lowIndex.set(s.address, bound ? bound.data.index : s.data.nextIndex);
    }
    return;
  }
  const fresh = await fetchSeries(state.client, state.series.map((s) => s.address));
  state.series = fresh.filter((s): s is SeriesView => s !== null);
}

type Bound = { series: SeriesView; market: MarketView };

/** Every Market in `[lowIndex, nextIndex)` of every Series, one batched read. Advances `lowIndex` past released or closed ones. */
async function readUnreleased(state: RollerState): Promise<Bound[]> {
  const wanted: Array<{ series: SeriesView; address: string; index: bigint }> = [];
  for (const s of state.series) {
    for (let i = state.lowIndex.get(s.address) ?? s.data.nextIndex; i < s.data.nextIndex; i++) {
      wanted.push({ series: s, address: (await windowAddresses(s.address, i)).market, index: i });
    }
  }
  const markets = await fetchMarkets(state.client, wanted.map((w) => w.address as never));
  const out: Bound[] = [];
  const advancing = new Set(state.series.map((s) => s.address));
  wanted.forEach((w, i) => {
    const market = markets[i];
    const done = !market || (market.data.flags & MARKET_FLAG.bookReleased) !== 0;
    if (done && advancing.has(w.series.address)) state.lowIndex.set(w.series.address, w.index + 1n);
    else advancing.delete(w.series.address);
    if (market && !done) out.push({ series: w.series, market });
  });
  return out;
}

const isCode = (error: unknown, ...codes: number[]) => error instanceof OpsSendError && error.code !== null && codes.includes(error.code);

/** Sweep then release every Book whose Window is locked or terminal. */
async function recycle(state: RollerState, bound: Bound[], nowSec: number, notes: string[]): Promise<number> {
  const due = bound.filter((b) => ["locked", "resolved", "voided"].includes(marketStatus(b.market.data, nowSec)));
  let released = 0;
  for (const { series, market } of due) {
    const ref = { series: series.address, market: market.address, book: market.data.book, ledger: market.data.ledger };
    const label = `${seriesKey(series)} #${market.data.index}`;
    if (state.dryRun) {
      notes.push(`DRY public_release_book ${label}`);
      continue;
    }
    try {
      for (let n = 0; n < SWEEPS_PER_BOOK; n++) {
        const [header] = await fetchBookHeaders(state.client, [market.data.book]);
        if (!header || header.market !== market.address || header.orderCount === 0) break;
        const signature = await sweepBook(state.client, ref);
        state.counters.swept++;
        notes.push(`swept ${label} (${header.orderCount} orders) ${signature}`);
      }
      await releaseBook(state.client, ref);
      state.counters.released++;
      released++;
      notes.push(`released ${label}`);
    } catch (error) {
      if (isCode(error, ENGINE_ERROR.bookMarketMismatch)) continue;
      state.counters.failed++;
      notes.push(`recycle ${label} failed: ${errorText(error)}`);
    }
  }
  return released;
}

/** PD-8: grow a listed or trading Market's Ledger when fewer than 8 seats remain (a prelisted Window takes calls too). */
async function grow(state: RollerState, bound: Bound[], nowSec: number, notes: string[]): Promise<void> {
  const trading = bound.filter((b) => ["listed", "trading"].includes(marketStatus(b.market.data, nowSec)));
  if (trading.length === 0) return;
  const headers = await fetchLedgerHeaders(state.client, trading.map((b) => b.market.data.ledger));
  for (const [i, header] of headers.entries()) {
    if (!header || header.seatsUsed < header.capacity - GROW_HEADROOM || header.capacity + GROW_SEATS > LEDGER_MAX_SEATS) continue;
    const { series, market } = trading[i]!;
    const label = `${seriesKey(series)} #${market.data.index} ledger ${header.seatsUsed}/${header.capacity}`;
    if (state.dryRun) {
      notes.push(`DRY public_grow_ledger ${label}`);
      continue;
    }
    try {
      await growLedger(state.client, { market: market.address, ledger: header.address, extraSeats: GROW_SEATS });
      state.counters.grown++;
      notes.push(`grew ${label}`);
    } catch (error) {
      state.counters.failed++;
      notes.push(`grow ${label} failed: ${errorText(error)}`);
    }
  }
}

function planFor(s: SeriesView, clock: PlanClock): SeriesPlan {
  const versions = s.data.policyVersions.slice(0, s.data.versionCount).map(versionWindow);
  const freeBooks = s.data.freeBooks.slice(0, s.data.freeBookCount);
  const series = {
    key: seriesKey(s), symbol: s.symbol!, cadenceSec: s.data.cadenceSec, maxLeadSec: s.data.maxLeadSec, nextIndex: s.data.nextIndex,
    lastExpirySec: Number(s.data.lastExpiry), versions, freeBooks,
  };
  return planByBasis(seriesBasis(s)!, series, clock);
}

/** Re-reads the Series, re-plans, and opens. Returns the lane state to report. */
async function open(state: RollerState, s: SeriesView, clock: PlanClock, notes: string[]): Promise<string> {
  const [fresh] = await fetchSeries(state.client, [s.address]);
  if (!fresh) return "series missing";
  const plan = planFor(fresh, clock);
  if (plan.kind !== "open") return plan.state;
  const key = seriesKey(fresh);
  if (state.dryRun) {
    notes.push(`DRY roller_open_window ${key} ${plan.state}`);
    return `DRY ${plan.state}`;
  }
  try {
    const w = plan.window;
    const opened = await openWindow(state.client, {
      series: fresh.address, index: plan.index, book: plan.book as never, collateralMint: state.config.collateralMint,
      tradingStartSec: w.tradingStartSec, lockAtSec: w.lockAtSec, expirySec: w.expirySec,
      policyVersion: plan.policyVersion, openKind: plan.openKind, closeKind: plan.closeKind,
    });
    state.counters.opened++;
    const version = describeVersion(plan.policyVersion, versionWindow(fresh.data.policyVersions[plan.policyVersion]!));
    // A prelisted Window says so until it starts trading: it holds SOL float from the previous close (D-089).
    const verb = plan.state.startsWith("prelisting") ? "prelisted" : "opened";
    notes.push(`${verb} ${key} #${plan.index} ${spanFor(fresh, w)} ${version} ${opened.signature}`);
    return `${verb === "prelisted" ? "prelisted" : "open"} #${plan.index} ${spanFor(fresh, w)} ${version}`;
  } catch (error) {
    if (isCode(error, ENGINE_ERROR.badWindowIndex, ENGINE_ERROR.windowOverlap)) return "already opened: re-reading";
    state.counters.failed++;
    notes.push(`open ${key} #${plan.index} failed: ${errorText(error)}`);
    return `open failed: ${errorText(error).split("\n")[0]}`;
  }
}

function currentState(s: SeriesView, bound: Bound[], nowSec: number): string | null {
  const live = bound.filter((b) => b.series.address === s.address && ["listed", "trading"].includes(marketStatus(b.market.data, nowSec)));
  const m = live.at(-1)?.market.data;
  if (!m) return null;
  const version = describeVersion(m.policyVersion, versionWindow(s.data.policyVersions[m.policyVersion]!));
  return `open #${m.index} ${spanFor(s, { tradingStartSec: Number(m.tradingStart), expirySec: Number(m.expiry) })} ${version}`;
}

export async function rollerPass(state: RollerState, deps: VenueDeps): Promise<PassResult> {
  const calendarNote = await deps.sessions.refresh();
  await refreshSeries(state);
  const nowSec = await chainNowSec(state.client);
  const notes: string[] = calendarNote === "calendar fresh" ? [] : [calendarNote];
  let bound = await readUnreleased(state);
  if ((await recycle(state, bound, nowSec, notes)) > 0) {
    await refreshSeries(state);
    bound = await readUnreleased(state);
  }
  await grow(state, bound, nowSec, notes);

  const clock: PlanClock = {
    calendar: deps.sessions.calendar(), nowSec, leadSec: state.settings.leadSec, gapLeadSec: state.settings.gapLeadSec,
    minTradableSec: state.settings.minTradableSec, skips: deps.events.skips(),
    multipliers: deps.events.multipliers(), halts: deps.halts.board(),
    prelist: state.settings.prelist, prelistCadencesSec: state.settings.prelistCadencesSec,
  };
  const lanes: Record<string, string> = {};
  let wakeSec = nowSec + 15;
  for (const s of state.series) {
    const plan = planFor(s, clock);
    const current = currentState(s, bound, nowSec);
    if (plan.kind === "open") lanes[seriesKey(s)] = await open(state, s, clock, notes);
    else lanes[seriesKey(s)] = plan.kind === "wait" && current ? current : plan.state;
    if ((plan.kind === "wait" || plan.kind === "paused") && plan.wakeSec < wakeSec) wakeSec = plan.wakeSec;
    // Wake at the next lock so the Book recycles promptly; an already-locked Book that failed waits for the normal cadence.
    for (const b of bound) if (b.series.address === s.address && Number(b.market.data.lockAt) > nowSec) wakeSec = Math.min(wakeSec, Number(b.market.data.lockAt));
  }
  // The prelist is the roller's SOL float: report what it has left next to the lanes holding it.
  if (Object.values(lanes).some((v) => v.includes("prelist"))) {
    const balance = (await state.client.rpc.getBalance(state.client.payer.address).send()).value;
    for (const [key, value] of Object.entries(lanes)) if (value.includes("prelist")) lanes[key] = `${value} · roller ${solText(balance)} SOL`;
  }
  const counts = Object.values(lanes).reduce<Record<string, number>>((acc, v) => ((acc[v.split(/[: #]/)[0]!] = (acc[v.split(/[: #]/)[0]!] ?? 0) + 1), acc), {});
  const summary = Object.entries(counts).map(([k, n]) => `${n} ${k}`).join(", ");
  const why = [`${state.series.length} series (${summary || "none"})`, ...notes].join(" · ");
  return {
    why,
    detail: { lanes, counters: { ...state.counters }, chainNowSec: nowSec, calendar: deps.sessions.calendar() ? "agreed" : "none" },
    nextDelayMs: Math.min(15_000, Math.max(2_000, (wakeSec - nowSec) * 1000)),
  };
}
