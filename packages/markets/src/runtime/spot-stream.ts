/**
 * One shared spot stream per tab (first-call.md §2.2 `getAssetPrice`): an `EventSource` on ops `/prices/stream`, opened
 * by the first subscriber and closed after the last leaves. A tab hidden for a minute closes it too; on return it
 * reopens and the stream's snapshot refills every symbol. Display only, never a settlement input.
 */
import { pageDocument, pageHidden } from "./page";
import { peekClient } from "./read-runtime";

export interface SpotTick {
  symbol: string;
  priceE8: bigint;
  publishTimeSec: number;
  source: string;
}

/** `live`: the stream is open and has sent its snapshot; anything else means read `/prices/latest` instead. */
export interface SpotView {
  tick: SpotTick | null;
  live: boolean;
}

const HIDDEN_CLOSE_MS = 60_000;
/** A route change unmounts and remounts every consumer; the stream outlives that gap instead of reconnecting. */
const LINGER_MS = 5_000;
const RETRY_MIN_MS = 5_000;
const RETRY_MAX_MS = 60_000;
const NOT_LIVE: SpotView = Object.freeze({ tick: null, live: false });

const ticks = new Map<string, SpotTick>();
const views = new Map<string, SpotView>();
const listeners = new Map<string, Set<() => void>>();
let source: EventSource | null = null;
let live = false;
let retryMs = RETRY_MIN_MS;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let hiddenTimer: ReturnType<typeof setTimeout> | null = null;
let lingerTimer: ReturnType<typeof setTimeout> | null = null;
let visibilityBound = false;

function notify(symbol: string | null): void {
  const targets = symbol === null ? [...listeners.keys()] : [symbol];
  for (const key of targets) {
    views.set(key, { tick: ticks.get(key) ?? null, live });
    for (const listener of listeners.get(key) ?? []) listener();
  }
}

function setLive(next: boolean): void {
  if (live === next) return;
  live = next;
  notify(null);
}

function onSpot(event: { data: string }): void {
  try {
    const raw = JSON.parse(event.data) as { symbol: string; priceE8: string; publishTimeSec: number; source: string };
    const previous = ticks.get(raw.symbol);
    if (previous && previous.publishTimeSec === raw.publishTimeSec && previous.priceE8 === BigInt(raw.priceE8)) return;
    ticks.set(raw.symbol, { symbol: raw.symbol, priceE8: BigInt(raw.priceE8), publishTimeSec: raw.publishTimeSec, source: raw.source });
    retryMs = RETRY_MIN_MS;
    if (!live) setLive(true);
    else notify(raw.symbol);
  } catch {
    // A malformed event is dropped; the next one carries the symbol again.
  }
}

function close(): void {
  source?.close();
  source = null;
  setLive(false);
}

function open(): void {
  const base = peekClient()?.priceFeedUrl;
  if (source || !base || typeof EventSource === "undefined" || listeners.size === 0) return;
  if (pageHidden()) return;
  const stream = new EventSource(`${base.replace(/\/$/, "")}/prices/stream`);
  source = stream;
  stream.addEventListener("spot", (event) => onSpot(event as unknown as { data: string }));
  stream.onerror = () => {
    if (stream !== source) return;
    setLive(false);
    // CONNECTING: the browser retries on its own. CLOSED: it gave up, so reopen with a backoff.
    if (stream.readyState !== EventSource.CLOSED) return;
    source = null;
    retryTimer ??= setTimeout(() => {
      retryTimer = null;
      open();
    }, retryMs);
    retryMs = Math.min(retryMs * 2, RETRY_MAX_MS);
  };
}

function bindVisibility(): void {
  const doc = pageDocument();
  if (visibilityBound || !doc) return;
  visibilityBound = true;
  doc.addEventListener("visibilitychange", () => {
    if (doc.visibilityState === "hidden") {
      hiddenTimer ??= setTimeout(() => {
        hiddenTimer = null;
        close();
      }, HIDDEN_CLOSE_MS);
      return;
    }
    if (hiddenTimer) clearTimeout(hiddenTimer);
    hiddenTimer = null;
    open();
  });
}

export function subscribeSpot(symbol: string, listener: () => void): () => void {
  let set = listeners.get(symbol);
  if (!set) listeners.set(symbol, (set = new Set()));
  if (!views.has(symbol)) views.set(symbol, { tick: ticks.get(symbol) ?? null, live });
  set.add(listener);
  if (lingerTimer) clearTimeout(lingerTimer);
  lingerTimer = null;
  bindVisibility();
  open();
  return () => {
    set.delete(listener);
    if (set.size === 0) listeners.delete(symbol);
    if (listeners.size > 0) return;
    lingerTimer ??= setTimeout(() => {
      lingerTimer = null;
      if (listeners.size > 0) return;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      close();
    }, LINGER_MS);
  };
}

/** Stable per symbol between changes, for `useSyncExternalStore`. */
export function spotView(symbol: string): SpotView {
  return views.get(symbol) ?? NOT_LIVE;
}

/** The latest streamed tick while the stream is live, else null. */
export function liveSpot(symbol: string): SpotTick | null {
  return live ? (ticks.get(symbol) ?? null) : null;
}
