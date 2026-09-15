"use client";

/**
 * What the lifecycle watcher has already announced, per wallet, under `agari.activity.seenThrough` (spec §1.6).
 *
 * `throughSec` is the newest event time announced. `ids` are the recently announced events themselves, shared through
 * storage so a second open tab does not announce them again. The cursor starts at the tab's mount, so nothing from
 * before it is ever announced — no backlog burst. Storage is best-effort: a blocked store falls back to this tab's memory.
 */
const STORAGE_KEY = "agari.activity.seenThrough";
const IDS_MAX = 100;

export interface SeenCursor {
  throughSec: number;
  ids: string[];
}

type Store = Record<string, SeenCursor>;
let memory: Store = {};

function readStore(): Store {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return memory;
  }
}

export function readCursor(wallet: string): SeenCursor {
  const cursor = readStore()[wallet];
  return cursor && typeof cursor.throughSec === "number" && Array.isArray(cursor.ids) ? cursor : { throughSec: 0, ids: [] };
}

/** Records newly announced ids (newest first, bounded) and advances `throughSec`. */
export function recordAnnounced(wallet: string, announced: readonly { id: string; atSec: number }[]): void {
  if (announced.length === 0) return;
  const store = readStore();
  const prior = store[wallet] ?? { throughSec: 0, ids: [] };
  const ids = [...announced.map((event) => event.id), ...prior.ids.filter((id) => !announced.some((event) => event.id === id))].slice(0, IDS_MAX);
  const throughSec = Math.max(prior.throughSec, ...announced.map((event) => event.atSec));
  store[wallet] = { throughSec, ids };
  memory = store;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage refused; this tab's memory still dedupes.
  }
}
