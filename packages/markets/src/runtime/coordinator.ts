/**
 * The market subscription coordinator.
 *
 * Every route that shows a book — the hero's ramp, its depth strip, each lane card's odds chips —
 * used to reach into the SDK's live store on its own. That cost more than it looks:
 *
 *  - The store memoizes derived books under keys that include the depth (`bookynm:<market>:<depth>`
 *    over `book:<pool>:<depth>`), so three consumers asking for three different depths made it walk
 *    the whole resting-order map three times per pool per block.
 *  - Its memo cache is keyed on a version that every new head bumps, so an unchanged book still
 *    arrived as a new object every block, and every consumer re-mapped and re-rendered on it.
 *
 * The coordinator sits between: one entry per market, one derivation at one canonical depth, and a
 * fan-out that fires only when the resting liquidity actually moved. Consumers take the depth they
 * display off the normalised value. The SDK's pool watches stay ref-counted underneath — this layer
 * holds exactly one per market, for as long as anything is reading it.
 *
 * It has no signer and no account, so it belongs here rather than in a session (see ../sessions).
 */
import type { BookTarget } from "@masayume/core/ports";
import type { Reading, ReadingOk } from "@masayume/core/schemas";
import type { BookDepth } from "@masayume/core/types";
import type { BinaryOrderBook, WatchHandle } from "@somnia-chain/markets-sdk";
import { toBookDepth } from "../mappers/book";
import { nowMs } from "../provider/clock";
import { decideBookEmit, reuseBookValue } from "./book-reading";
import { getClient, onRuntimeClose, subscribeExchange } from "./read-runtime";

/**
 * The one depth the live store is asked for. Every consumer slices what it shows out of this, so
 * the store keeps a single `book:<pool>:<depth>` cache entry per pool instead of one per consumer.
 * It matches the SDK's own default, so `useStakeQuote` — which needs the raw book — shares it too.
 */
export const CANONICAL_BOOK_DEPTH = 10;

interface BookEntry {
  readonly marketId: string;
  readonly poolAddress: string;
  readonly decimals: number;
  /** The generation of the read runtime this entry's watch belongs to; a rotation invalidates it. */
  generation: number;
  watch: WatchHandle | null;
  watchPending: boolean;
  /** The last raw book seen, so an unchanged store version skips the mapping entirely. */
  raw: BinaryOrderBook | null;
  /** The fanned-out snapshot. Null means hydrating — never an empty book we have not actually read. */
  reading: ReadingOk<BookDepth> | null;
  /** When the current value was last confirmed against a live tail; the `asOfMs` a stale reading carries. */
  confirmedAtMs: number;
  readonly listeners: Set<() => void>;
}

const entries = new Map<string, BookEntry>();
let generation = 0;
let detachLive: (() => void) | null = null;
let detachExchange: (() => void) | null = null;
let detachClose: (() => void) | null = null;

function emit(entry: BookEntry, reading: ReadingOk<BookDepth> | null): void {
  if (entry.reading === reading) return;
  entry.reading = reading;
  for (const listener of entry.listeners) listener();
}

function refreshEntry(entry: BookEntry, wsConnected: boolean, atMs: number): void {
  const client = getClient();
  const watchStatus = client.getWatchStatus(entry.poolAddress);
  if (watchStatus === "hydrating" || entry.watch === null) {
    emit(entry, null);
    return;
  }

  // Keyed by market, not by pool: a recycled pool returns an empty book for the market that no
  // longer holds it, so a stale page never shows its successor's liquidity (canon #3).
  const raw = client.getLiveBinaryOrderBookByMarket(entry.marketId, { depth: CANONICAL_BOOK_DEPTH });
  const previous = entry.reading;
  // An unchanged store version means an unchanged raw object, and skips the mapping outright.
  const value =
    raw === entry.raw && previous ? previous.value : reuseBookValue(previous?.value, toBookDepth(raw, entry.decimals));
  entry.raw = raw;

  const live = watchStatus === "live" && wsConnected;
  if (live) entry.confirmedAtMs = atMs;
  const decision = decideBookEmit(previous, value, live, entry.confirmedAtMs);
  if (!decision.hold) emit(entry, decision.reading);
}

function refreshAll(): void {
  if (entries.size === 0) return;
  const wsConnected = getClient().getLiveStatus().wsConnected;
  const atMs = nowMs();
  for (const entry of entries.values()) refreshEntry(entry, wsConnected, atMs);
}

function acquireWatch(entry: BookEntry): void {
  if (entry.watch !== null || entry.watchPending) return;
  entry.watchPending = true;
  const at = entry.generation;
  void getClient()
    .watchMarket(entry.poolAddress)
    .then(
      (handle) => {
        entry.watchPending = false;
        // Released, or the runtime was rebuilt, while the acquisition was in flight.
        if (entries.get(entry.marketId) !== entry || entry.generation !== at) {
          handle.stop();
          return;
        }
        entry.watch = handle;
        refreshAll();
      },
      () => {
        entry.watchPending = false;
      },
    );
}

/**
 * Rebinds every entry onto a rebuilt read runtime. The previous client is closed with its watches
 * and its live store, so each entry goes back to hydrating rather than keeping a book that nothing
 * is confirming any more.
 */
function rebind(): void {
  generation += 1;
  detachLive?.();
  detachLive = null;
  for (const entry of entries.values()) {
    entry.generation = generation;
    entry.watch = null;
    entry.watchPending = false;
    entry.raw = null;
    emit(entry, null);
    acquireWatch(entry);
  }
  if (entries.size > 0) attachLive();
}

function attachLive(): void {
  detachLive ??= getClient().subscribeLive(refreshAll);
  detachExchange ??= subscribeExchange(rebind);
  detachClose ??= onRuntimeClose(resetCoordinator);
}

function detachAll(): void {
  detachLive?.();
  detachLive = null;
  detachExchange?.();
  detachExchange = null;
  detachClose?.();
  detachClose = null;
}

function release(entry: BookEntry): void {
  if (entry.listeners.size > 0) return;
  entries.delete(entry.marketId);
  entry.watch?.stop();
  entry.watch = null;
  if (entries.size === 0) detachAll();
}

/**
 * Holds one normalised book for `target` while at least one listener is subscribed, and calls back
 * only when its resting liquidity or its liveness changes. Read the value with {@link bookSnapshot}.
 */
export function subscribeBook(target: BookTarget, listener: () => void): () => void {
  let entry = entries.get(target.marketId);
  if (!entry) {
    entry = {
      marketId: target.marketId,
      poolAddress: target.poolAddress,
      decimals: target.decimals,
      generation,
      watch: null,
      watchPending: false,
      raw: null,
      reading: null,
      confirmedAtMs: nowMs(),
      listeners: new Set(),
    };
    entries.set(target.marketId, entry);
    attachLive();
    acquireWatch(entry);
  }
  const held = entry;
  held.listeners.add(listener);
  return () => {
    held.listeners.delete(listener);
    release(held);
  };
}

/** The current normalised book, or null while the market's watch is still hydrating. */
export function bookSnapshot(marketId: string | null): Reading<BookDepth> | null {
  return marketId === null ? null : (entries.get(marketId)?.reading ?? null);
}

/** Drops every entry and its watches — runs before `closeRuntime` closes the client they are held on. */
export function resetCoordinator(): void {
  for (const entry of entries.values()) {
    entry.watch?.stop();
    emit(entry, null);
  }
  entries.clear();
  detachAll();
}
