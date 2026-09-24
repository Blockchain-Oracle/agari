"use client";

import { CLUSTER } from "@agari/markets/chain";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { del, get, set } from "idb-keyval";
import { useEffect } from "react";

/**
 * The read cache that survives a reload.
 *
 * A hard refresh had no last-good anything: `withReading`'s memory lives for the life of the
 * document, so every returning user paid the full cold chain cost again, and the boot facts
 * alone measured 0.4-2.0 s of that.
 *
 * What is written to disk is a deliberately short list. The public list is chain-scoped and
 * slowly changing, and comes back as a live answer. The account list (09-24) is the connected
 * wallet's own balance sheet, open bets and claims: refusing it made every refresh read the
 * balance and the Open tab from nothing, through a paced RPC, for seconds. Those entries are
 * keyed by the wallet's address, so one wallet's rows can never answer another's read; they come
 * back marked aged and dated when they were stored, so the page shows the last true figure and
 * refetches it at once instead of treating it as fresh. Grants, sessions and history stay off disk.
 *
 * Bump `SCHEMA_VERSION` whenever a persisted value's shape changes; with the cluster it is
 * the cache buster, and a namespace miss simply reads as "nothing stored".
 */
const SCHEMA_VERSION = 1;
const NAMESPACE = `agari.read-cache.v${SCHEMA_VERSION}.${CLUSTER}`;
const MAX_AGE_MS = 24 * 60 * 60 * 1_000;
/** An account entry older than this is not worth showing, even labelled. */
const ACCOUNT_MAX_AGE_MS = 15 * 60 * 1_000;
const WRITE_DEBOUNCE_MS = 1_000;

interface StoredEntry {
  key: QueryKey;
  value: unknown;
  storedAtMs: number;
}

/**
 * The allowlist.
 *
 * - collateral decimals and symbol: a property of the chain's token, not of anyone holding it;
 * - the live venue id: public, and revalidated within a market tick of coming back;
 * - a pool's tick/lot/minimum: constant for the pool's life, by that read's own contract.
 *
 * Everything else is refused on purpose. Live quotes, books and marks go stale in seconds and a
 * remembered price is a lie. Positions, balances, claims and history are account-scoped. Grants,
 * sessions and any pending transaction authority must never touch disk at all.
 */
export function isPersistable(key: QueryKey): boolean {
  const [, , family, sub] = key as readonly unknown[];
  if (family === "boot") return sub === "collateral" || sub === "venue";
  return family === "bookParams" || isAccountEntry(key);
}

/**
 * The account allowlist: what the portfolio's first screen needs for the wallet in the key — its balance sheet, open
 * positions and resting calls, the vault's open bets (every X trade), live boosts and claims. Never the vault snapshot
 * (it carries grants) or history.
 */
export function isAccountEntry(key: QueryKey): boolean {
  const k = key as readonly unknown[];
  if (k[0] !== "agari" || k[1] !== "markets" || typeof k[3] !== "string") return false;
  switch (k[2]) {
    case "positions":
      return k.length === 4 || (k.length === 5 && k[4] === "resting");
    case "balanceSheet":
    case "leverage":
    case "vaultOpenBets":
      return k.length === 4;
    case "claimables":
      return k.length === 5;
    default:
      return false;
  }
}

/** A restored value is true but old: it says so until its own read confirms it. */
function aged(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const reading = value as { ok?: unknown; stale?: unknown };
  if (reading.ok !== true) return value;
  return { ...reading, stale: true, staleReason: "aged" };
}

async function restore(queryClient: QueryClient): Promise<void> {
  const stored = await get<StoredEntry[]>(NAMESPACE).catch(() => undefined);
  if (!stored) return;
  const now = Date.now();
  for (const entry of stored) {
    const account = isAccountEntry(entry.key);
    if (now - entry.storedAtMs > (account ? ACCOUNT_MAX_AGE_MS : MAX_AGE_MS)) continue;
    if (!isPersistable(entry.key)) continue;
    // Never overwrite a live answer that already arrived while the restore was in flight.
    if (queryClient.getQueryData(entry.key) !== undefined) continue;
    // An account entry keeps its real age, so its query is stale on arrival and refetches as soon as it may run.
    queryClient.setQueryData(entry.key, aged(entry.value), account ? { updatedAt: entry.storedAtMs } : undefined);
  }
}

function collect(queryClient: QueryClient): StoredEntry[] {
  const now = Date.now();
  return queryClient
    .getQueryCache()
    .getAll()
    .filter((query) => query.state.status === "success" && query.state.data !== undefined && isPersistable(query.queryKey))
    // A restored account entry not yet confirmed keeps its first date, so re-saving it cannot make it look newer.
    .map((query) => ({ key: query.queryKey, value: query.state.data, storedAtMs: isAccountEntry(query.queryKey) ? query.state.dataUpdatedAt : now }));
}

/**
 * Restores the allowlisted entries once, then keeps them written.
 *
 * Restoration deliberately does not block the application: the same reads are already in
 * flight, and a restored value that lands first simply opens their dependants sooner. Values
 * are stored by structured clone, so the `bigint`s in a book's parameters survive intact —
 * JSON would have quietly turned them into a string or thrown.
 */
export function usePersistedReadCache(queryClient: QueryClient): void {
  useEffect(() => {
    void restore(queryClient);

    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== "updated" || !isPersistable(event.query.queryKey)) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        const entries = collect(queryClient);
        void (entries.length > 0 ? set(NAMESPACE, entries) : del(NAMESPACE)).catch(() => undefined);
      }, WRITE_DEBOUNCE_MS);
    });

    return () => {
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, [queryClient]);
}
