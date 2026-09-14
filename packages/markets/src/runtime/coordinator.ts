/**
 * The Book coordinator (first-call.md §2.2): one normalised Book per Window, shared by every consumer, fanned out only
 * when resting liquidity or liveness changes (`book-reading.ts` decides). Each Book is read once and then pushed by a
 * ref-counted `accountNotifications` subscription on the tab's one websocket, at most `MAX_LIVE` at a time; extra
 * Books share one batched read every 15 s. Expiry removes orders without a write, so readings are re-filtered every
 * 5 s. A tab hidden for 30 s drops its subscriptions and re-reads on return. A Book bound to another Window reads empty.
 */
import type { BookTarget } from "@agari/core/ports";
import type { Reading, ReadingOk } from "@agari/core/schemas";
import type { BookDepth } from "@agari/core/types";
import { getBase64Encoder, type Address, type Base64EncodedDataResponse } from "@solana/kit";
import { nowMs, nowSec } from "../provider/clock";
import { readBook, readSeries, type SeriesFacts } from "./accounts";
import { decideBookEmit, reuseBookValue } from "./book-reading";
import { decodeBook, type BookState } from "./decode";
import { BOOK_LEVELS, EMPTY_BOOK_DEPTH, toBookDepth } from "./mappers";
import { pageDocument, pageHidden } from "./page";
import { onRuntimeClose, subscribeExchange } from "./read-runtime";
import { solana } from "./solana";

/** How many levels each side a coordinated Book carries; callers slice what they display. */
export const CANONICAL_BOOK_DEPTH = BOOK_LEVELS;
const MAX_LIVE = 12;
const REFILTER_MS = 5_000;
const POLL_MS = 15_000;
const HIDDEN_DROP_MS = 30_000;
const RETRY_MIN_MS = 1_000;
const RETRY_MAX_MS = 30_000;
/** Subscription acks arrive one message at a time; their catch-up reads wait this long to share one batch. */
const CATCH_UP_MS = 300;

/** The raw Book and its Series behind a Window's reading, for the ticket's quote walk. */
export interface BookStateView {
  book: BookState;
  series: SeriesFacts;
  live: boolean;
}

interface BookEntry {
  readonly target: BookTarget;
  mode: "live" | "polled";
  abort: AbortController | null;
  subscribed: boolean;
  retryMs: number;
  state: BookState | null;
  series: SeriesFacts | null;
  view: BookStateView | null;
  reading: ReadingOk<BookDepth> | null;
  confirmedAtMs: number;
  readonly listeners: Set<() => void>;
}

const entries = new Map<string, BookEntry>();
let timers: { refilter: ReturnType<typeof setInterval>; poll: ReturnType<typeof setInterval> } | null = null;
let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
let paused = false;
let detach: (() => void)[] = [];
const catchUp = new Set<BookEntry>();
let catchUpTimer: ReturnType<typeof setTimeout> | null = null;

function notify(entry: BookEntry): void {
  for (const listener of entry.listeners) listener();
}

/** Re-derives the entry's reading from its last bytes at the current chain second; emits only on a real change. */
function refresh(entry: BookEntry): void {
  const { state, series } = entry;
  if (!state || !series) return;
  const live = entry.mode === "polled" ? !paused : entry.subscribed && !paused;
  const bound = state.market === (entry.target.marketId as string);
  const mapped = bound ? toBookDepth(state, series, entry.target.decimals, nowSec()) : EMPTY_BOOK_DEPTH(entry.target.decimals);
  const previous = entry.reading;
  const value = reuseBookValue(previous?.value, mapped);
  if (live) entry.confirmedAtMs = nowMs();
  const view = entry.view && entry.view.book === state && entry.view.live === live ? entry.view : { book: state, series, live };
  const decision = decideBookEmit(previous, value, live, entry.confirmedAtMs);
  const viewChanged = view !== entry.view;
  entry.view = view;
  if (!decision.hold) entry.reading = decision.reading;
  if (!decision.hold || viewChanged) notify(entry);
}

/** Newer bytes only: a snapshot read can land after a notification from a later slot. */
async function apply(entry: BookEntry, state: BookState): Promise<void> {
  if (entry.state && entry.state.slot > state.slot) return;
  entry.state = state;
  entry.series ??= await readSeries(state.series).catch(() => null);
  if (entries.get(entry.target.marketId) === entry) refresh(entry);
}

async function readOnce(entry: BookEntry): Promise<void> {
  const state = await readBook(entry.target.poolAddress).catch(() => null);
  if (state) await apply(entry, state);
}

/** One batched re-read for every Book whose subscription just opened, so a change before it can't be missed. */
function scheduleCatchUp(entry: BookEntry): void {
  catchUp.add(entry);
  catchUpTimer ??= setTimeout(() => {
    catchUpTimer = null;
    const due = [...catchUp];
    catchUp.clear();
    for (const e of due) if (entries.get(e.target.marketId) === e) void readOnce(e);
  }, CATCH_UP_MS);
}

async function watch(entry: BookEntry): Promise<void> {
  if (entry.abort || paused) return;
  const abort = new AbortController();
  entry.abort = abort;
  const address = entry.target.poolAddress as string as Address;
  try {
    const notifications = await solana()
      .subscriptions.accountNotifications(address, { encoding: "base64", commitment: "confirmed" })
      .subscribe({ abortSignal: abort.signal });
    entry.subscribed = true;
    entry.retryMs = RETRY_MIN_MS;
    // The mount read already painted; this one closes the gap before the subscription (`apply` keeps the newer slot).
    scheduleCatchUp(entry);
    const encoder = getBase64Encoder();
    for await (const { context, value } of notifications) {
      const bytes = encoder.encode((value.data as Base64EncodedDataResponse)[0]);
      await apply(entry, decodeBook(address, bytes, context.slot));
    }
  } catch {
    // The socket dropped or the subscription was refused; aborted on purpose is handled below.
  }
  const deliberate = abort.signal.aborted;
  if (entry.abort === abort) entry.abort = null;
  entry.subscribed = false;
  if (entries.get(entry.target.marketId) !== entry || deliberate) return;
  refresh(entry);
  const delay = entry.retryMs;
  entry.retryMs = Math.min(delay * 2, RETRY_MAX_MS);
  setTimeout(() => entries.get(entry.target.marketId) === entry && entry.mode === "live" && void watch(entry), delay);
}

function stop(entry: BookEntry): void {
  entry.abort?.abort();
  entry.abort = null;
  entry.subscribed = false;
}

/** Keeps the first `MAX_LIVE` Windows (in subscription order) on the websocket; the rest are polled. */
function assignModes(): void {
  let live = 0;
  for (const entry of entries.values()) {
    const mode = live < MAX_LIVE ? "live" : "polled";
    if (mode === "live") live += 1;
    if (entry.mode === mode) continue;
    entry.mode = mode;
    if (mode === "live") void watch(entry);
    else stop(entry);
  }
}

function pollPolled(): void {
  if (paused) return;
  for (const entry of entries.values()) if (entry.mode === "polled") void readOnce(entry);
}

function onVisibility(): void {
  if (pageHidden()) {
    hiddenTimer ??= setTimeout(() => {
      hiddenTimer = null;
      paused = true;
      for (const entry of entries.values()) {
        stop(entry);
        refresh(entry);
      }
    }, HIDDEN_DROP_MS);
    return;
  }
  if (hiddenTimer) clearTimeout(hiddenTimer);
  hiddenTimer = null;
  if (!paused) return;
  paused = false;
  for (const entry of entries.values()) void (entry.mode === "live" ? watch(entry) : readOnce(entry));
}

function attach(): void {
  if (timers) return;
  timers = {
    refilter: setInterval(() => entries.forEach(refresh), REFILTER_MS),
    poll: setInterval(pollPolled, POLL_MS),
  };
  const doc = pageDocument();
  if (doc) {
    doc.addEventListener("visibilitychange", onVisibility);
    detach.push(() => doc.removeEventListener("visibilitychange", onVisibility));
  }
  detach.push(subscribeExchange(rebind), onRuntimeClose(resetCoordinator));
}

function detachAll(): void {
  if (timers) {
    clearInterval(timers.refilter);
    clearInterval(timers.poll);
  }
  timers = null;
  for (const undo of detach) undo();
  detach = [];
}

/** The runtime moved to other endpoints: everything read on the old ones goes back to hydrating. */
function rebind(): void {
  for (const entry of entries.values()) {
    stop(entry);
    Object.assign(entry, { state: null, series: null, view: null, reading: null, mode: "polled" });
    notify(entry);
  }
  assignModes();
  pollPolled();
}

/**
 * Holds one normalised Book for `target` while at least one listener is subscribed, and calls back only when its
 * resting liquidity or liveness changes. Read the value with {@link bookSnapshot}.
 */
export function subscribeBook(target: BookTarget, listener: () => void): () => void {
  let entry = entries.get(target.marketId);
  if (!entry) {
    entry = { target, mode: "polled", abort: null, subscribed: false, retryMs: RETRY_MIN_MS, state: null, series: null, view: null, reading: null, confirmedAtMs: nowMs(), listeners: new Set() };
    entries.set(target.marketId, entry);
    attach();
    assignModes();
    // Every Book a render mounts is read in the same batch, before any subscription acks.
    void readOnce(entry);
  }
  const held = entry;
  held.listeners.add(listener);
  return () => {
    held.listeners.delete(listener);
    if (held.listeners.size > 0) return;
    entries.delete(held.target.marketId);
    stop(held);
    if (entries.size === 0) detachAll();
    else assignModes();
  };
}

/** The current normalised Book, or null while the Window's Book is still hydrating. */
export function bookSnapshot(marketId: string | null): Reading<BookDepth> | null {
  return marketId === null ? null : (entries.get(marketId)?.reading ?? null);
}

/** The raw Book behind a coordinated reading (stable between changes), or null while hydrating. */
export function bookStateSnapshot(marketId: string | null): BookStateView | null {
  return marketId === null ? null : (entries.get(marketId)?.view ?? null);
}

/** Drops every entry and its subscriptions — runs before `closeRuntime`. */
export function resetCoordinator(): void {
  for (const entry of entries.values()) {
    stop(entry);
    entry.reading = null;
    entry.view = null;
    notify(entry);
  }
  entries.clear();
  detachAll();
}
