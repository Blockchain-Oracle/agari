import { storage } from "~/lib/storage";

/**
 * web `lifecycle-cursor.ts`: what the lifecycle watcher has already announced, per wallet, under
 * `agari.activity.seenThrough` — here in the app's MMKV store for web's localStorage, so a relaunch never re-announces.
 */
const STORAGE_KEY = "agari.activity.seenThrough";
const IDS_MAX = 100;

export interface SeenCursor {
  throughSec: number;
  ids: string[];
}
type Store = Record<string, SeenCursor>;

function readStore(): Store {
  try {
    const raw = storage.getString(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Store) : {};
  } catch {
    return {};
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
  const ids = [...announced.map((e) => e.id), ...prior.ids.filter((id) => !announced.some((e) => e.id === id))].slice(0, IDS_MAX);
  store[wallet] = { throughSec: Math.max(prior.throughSec, ...announced.map((e) => e.atSec)), ids };
  try {
    storage.set(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // Storage refused; the watcher's own `seen` set still dedupes this session.
  }
}
