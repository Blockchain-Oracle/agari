/**
 * The valuation lane's spot (S20, D-125): Hermes `latest` for every valuation index the store says the key is
 * entitled to, every 10 s in one request that carries index feeds only, floored to 10⁻⁸ from Pyth's own integers. Two
 * hours of samples stay in memory so the maker can read the index at a Window's start and `/pyth-index/latest` can
 * say how the token price sits against it. `joinPythIndexSpot` publishes the index under the valuation lane's symbol
 * (`OPENAIV`, source `"pyth"`) of the process `SpotFeed`; every other symbol falls through to the base feed.
 *
 * Nothing is asked while no feed is entitled, and a 401/403 met here is recorded in the store as denied, never latched:
 * this poll can never stop the trial feeds. Display and quoting only: the Window settles on the receiver's post.
 */
import { TICKERS, type PreIpoSymbol, type TickerSymbol } from "@agari/core/market";
import { HERMES, parsePythEntries } from "../actors/price-relay/hermes-fetch";
import { errorText } from "../runtime/env";
import { registerHeartbeat } from "../runtime/heartbeat";
import { refusalReason, type PythEntitlementStore } from "../runtime/pyth-entitlement";
import type { SpotFeed, SpotQuote } from "./spot";

export interface PythIndexSample {
  symbol: PreIpoSymbol;
  feedIdHex: string;
  /** The valuation index × 10⁸ (Hermes publishes at expo −5). */
  indexE8: bigint;
  conf: bigint;
  price: bigint;
  expo: number;
  publishTimeSec: number;
  prevPublishTimeSec: number | null;
  /** Wall second the answer arrived. */
  fetchedAtSec: number;
}

export interface PythIndexSpotFeed {
  /** The latest sample, or null when none has a publish time fresher than `maxAgeSec` (default 30). */
  latest(symbol: PreIpoSymbol, maxAgeSec?: number): PythIndexSample | null;
  /** The newest sample published in `[sec − windowSec, sec]` (default 15 s), or null. */
  at(symbol: PreIpoSymbol, sec: number, windowSec?: number): PythIndexSample | null;
  /** Every kept sample of the last two hours, oldest first. */
  history(symbol: PreIpoSymbol): readonly PythIndexSample[];
  /** The names with at least one sample. */
  symbols(): readonly PreIpoSymbol[];
  subscribe(listener: (sample: PythIndexSample) => void): () => void;
}

export interface PythIndexSpotHandle extends PythIndexSpotFeed {
  start(): void;
  stop(): void;
}

export const PYTH_INDEX_SPOT_EVERY_MS = 10_000;
const KEEP_SEC = 2 * 3_600;
const TIMEOUT_MS = 15_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let current: PythIndexSpotFeed | null = null;
/** The running feed in this process, for the maker; null until one starts. */
export const currentPythIndexSpot = (): PythIndexSpotFeed | null => current;

export function createPythIndexSpotFeed(input: { store: PythEntitlementStore; key: string | undefined; log: (why: string) => void; fetch?: typeof globalThis.fetch }): PythIndexSpotHandle {
  const fetchImpl = input.fetch ?? globalThis.fetch;
  const history = new Map<PreIpoSymbol, PythIndexSample[]>();
  const listeners = new Set<(sample: PythIndexSample) => void>();
  const beat = registerHeartbeat("pyth-index-spot", false, PYTH_INDEX_SPOT_EVERY_MS);
  let stopped = false;
  let loggedFailure = false;

  const push = (sample: PythIndexSample) => {
    const list = history.get(sample.symbol) ?? [];
    const last = list.at(-1);
    if (last && last.publishTimeSec >= sample.publishTimeSec) return;
    list.push(sample);
    while (list.length && list[0]!.publishTimeSec < sample.publishTimeSec - KEEP_SEC) list.shift();
    history.set(sample.symbol, list);
    for (const listener of listeners) listener(sample);
  };

  async function pollOnce(): Promise<void> {
    const feeds = input.store.entitled();
    if (feeds.length === 0 || !input.key) {
      beat.lastOkMs = beat.lastPassMs = Date.now();
      beat.failures = 0;
      beat.lastWhy = input.key ? "idle: no valuation index is entitled" : "idle: no PYTH_API_KEY";
      return;
    }
    const ids = feeds.map((f) => `ids[]=${f.feedIdHex}`).join("&");
    const res = await fetchImpl(`${HERMES}/v2/updates/price/latest?${ids}&parsed=true`, { headers: { Authorization: `Bearer ${input.key}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status === 401 || res.status === 403) {
      // An index-only request: the refusal belongs to the store, and the trial feeds keep streaming.
      const reason = refusalReason(await res.text().catch(() => ""));
      for (const f of feeds) input.store.markDenied(f.feedIdHex, res.status, reason);
      throw new Error(`Hermes refused the valuation indices (HTTP ${res.status} ${reason}); recorded as denied`);
    }
    if (!res.ok) throw new Error(`Hermes HTTP ${res.status}`);
    const body = (await res.json()) as { parsed?: Parameters<typeof parsePythEntries>[0] };
    const bySymbol = new Map(feeds.map((f) => [f.feedIdHex, f.symbol]));
    const fetchedAtSec = Math.floor(Date.now() / 1000);
    for (const p of parsePythEntries(body.parsed ?? [])) {
      const symbol = bySymbol.get(p.feedIdHex);
      if (symbol) push({ symbol, feedIdHex: p.feedIdHex, indexE8: p.priceE8, conf: p.conf, price: p.price, expo: p.expo, publishTimeSec: p.publishTimeSec, prevPublishTimeSec: p.prevPublishTimeSec, fetchedAtSec });
    }
    beat.lastOkMs = beat.lastPassMs = Date.now();
    beat.failures = 0;
    beat.lastWhy = `${feeds.length} index feed(s) read`;
    beat.detail = Object.fromEntries([...history].map(([s, list]) => [s, { indexE8: list.at(-1)!.indexE8.toString(), publishTimeSec: list.at(-1)!.publishTimeSec }]));
    loggedFailure = false;
  }

  async function poll(): Promise<void> {
    while (!stopped) {
      const started = Date.now();
      try {
        await pollOnce();
      } catch (error) {
        beat.failures += 1;
        beat.lastPassMs = Date.now();
        beat.lastWhy = `Pyth index read failed: ${errorText(error)}`;
        if (!loggedFailure) input.log(beat.lastWhy);
        loggedFailure = true;
      }
      await sleep(Math.max(0, PYTH_INDEX_SPOT_EVERY_MS - (Date.now() - started)));
    }
  }

  const feed: PythIndexSpotHandle = {
    latest(symbol, maxAgeSec = 30) {
      const last = history.get(symbol)?.at(-1);
      return last && Math.floor(Date.now() / 1000) - last.publishTimeSec <= maxAgeSec ? last : null;
    },
    at(symbol, sec, windowSec = 15) {
      const list = history.get(symbol) ?? [];
      for (let i = list.length - 1; i >= 0; i--) {
        const s = list[i]!;
        if (s.publishTimeSec <= sec) return s.publishTimeSec >= sec - windowSec ? s : null;
      }
      return null;
    },
    history: (symbol) => history.get(symbol) ?? [],
    symbols: () => [...history.keys()].filter((s) => (history.get(s)?.length ?? 0) > 0),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      current = feed;
      beat.lastWhy = "polling";
      void poll();
    },
    stop() {
      stopped = true;
      if (current === feed) current = null;
    },
  };
  return feed;
}

/** The pre-IPO name a valuation lane prices, or null for any other symbol. */
export const valuationNameOf = (symbol: string): PreIpoSymbol | null => {
  const t = TICKERS[symbol as TickerSymbol];
  return t && t.kind === "valuation" ? t.valuationOf : null;
};

const asSpot = (lane: TickerSymbol, s: PythIndexSample): SpotQuote => ({ symbol: lane, priceE8: s.indexE8, publishTimeSec: s.publishTimeSec, source: "pyth" });

/** One `SpotFeed` over both: a valuation lane's symbol reads its index, every other symbol reads `base`. */
export function joinPythIndexSpot(base: SpotFeed | null, index: PythIndexSpotFeed): SpotFeed {
  return {
    latest(symbol, maxAgeSec) {
      const name = valuationNameOf(symbol);
      if (!name) return base?.latest(symbol, maxAgeSec) ?? null;
      const s = index.latest(name, maxAgeSec);
      return s ? asSpot(symbol as TickerSymbol, s) : null;
    },
    subscribe(listener) {
      const offBase = base?.subscribe(listener);
      const offIndex = index.subscribe((s) => {
        const lane = TICKERS[`${s.symbol}V` as TickerSymbol];
        if (lane?.kind === "valuation" && lane.valuationOf === s.symbol) listener(asSpot(lane.symbol, s));
      });
      return () => {
        offBase?.();
        offIndex();
      };
    },
  };
}
