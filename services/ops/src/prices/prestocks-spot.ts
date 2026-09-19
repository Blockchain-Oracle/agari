/**
 * The Pre-IPO lane's spot (D-100, plan Step 1): the PreStocks catalogue's `tokenPrice` and `markPrice` for every
 * registry pre-IPO name, read every 10 s and floored to 10⁻⁸ from the JSON source text (`fetchPreStocks`, no floats).
 * A row is kept only when its `contract_address` equals the registry mint (`TICKERS[symbol].preIpo.mint`): a re-issued
 * or impostor mint is dropped, never priced. Two hours of samples stay in memory so the PreStocks relay pass can sign
 * the sample nearest a boundary and the maker can read the spot at a Window's start. `joinPreStocksSpot` publishes
 * `tokenPrice` under the ticker symbols of the process `SpotFeed` (source `"prestocks"`, publish time = read time);
 * every other symbol falls through to the base feed. Display and quoting only: nothing here settles anything.
 */
import { PRE_IPO_TICKERS, TICKERS, type TickerSymbol } from "@agari/core/market";
import { fetchPreStocks, type PreStocksRead } from "@agari/markets/ops/prints";
import { errorText } from "../runtime/env";
import { registerHeartbeat } from "../runtime/heartbeat";
import type { SpotFeed, SpotQuote } from "./spot";

export interface PreStocksSample {
  symbol: TickerSymbol;
  /** The registry mint the row was checked against. */
  mint: string;
  /** What the token trades at, × 10⁸: the price the lane prints and a holder can realise. */
  tokenPriceE8: bigint;
  /** The SPV's valuation of the company, × 10⁸: context only, it barely moves. */
  markPriceE8: bigint;
  /** Wall second the catalogue body arrived; PreStocks carries no timestamp of its own. */
  fetchedAtSec: number;
}

export interface PreStocksSpotFeed {
  /** The latest sample, or null when none is fresher than `maxAgeSec` (default 30). */
  latest(symbol: TickerSymbol, maxAgeSec?: number): PreStocksSample | null;
  /** The newest sample taken in `[sec − windowSec, sec]` (default 15 s), or null. */
  at(symbol: TickerSymbol, sec: number, windowSec?: number): PreStocksSample | null;
  /** Every kept sample of the last two hours, oldest first. */
  history(symbol: TickerSymbol): readonly PreStocksSample[];
  /** The pre-IPO names this feed prices. */
  symbols(): readonly TickerSymbol[];
  subscribe(listener: (sample: PreStocksSample) => void): () => void;
}

export interface PreStocksSpotHandle extends PreStocksSpotFeed {
  start(): void;
  stop(): void;
}

/** The base poll; `PRESTOCKS_POLL_MS` overrides it. 10 s keeps ~3 samples inside a print's 35 s honest window. */
export const PRESTOCKS_SPOT_EVERY_MS = Math.max(5_000, Number(process.env.PRESTOCKS_POLL_MS) || 10_000);
/** PreStocks rate-limits (a 429 landed after a minute of 10 s polling on 2026-09-19, no limit headers): back off, double, cap. */
export const BACKOFF_FIRST_MS = 30_000;
export const BACKOFF_MAX_MS = 5 * 60_000;

/** The wait after `failures` consecutive failed reads: the base poll after none, else 30 s doubling to 5 min. Pure. */
export function nextDelayMs(failures: number, baseMs = PRESTOCKS_SPOT_EVERY_MS): number {
  if (failures <= 0) return baseMs;
  return Math.min(BACKOFF_MAX_MS, BACKOFF_FIRST_MS * 2 ** Math.min(failures - 1, 10));
}
const KEEP_SEC = 2 * 3_600;
/** Every registry pre-IPO name with its verified mint; the catalogue is matched against this, never the other way. */
const NAMES: readonly { symbol: TickerSymbol; mint: string }[] = PRE_IPO_TICKERS.map((symbol) => ({ symbol, mint: String(TICKERS[symbol].preIpo!.mint) }));
const isPreIpo = (symbol: string): symbol is TickerSymbol => NAMES.some((n) => n.symbol === symbol);

let current: PreStocksSpotFeed | null = null;
/** The running feed in this process, for the relay pass and the maker; null until one starts. */
export const currentPreStocksSpot = (): PreStocksSpotFeed | null => current;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** One catalogue read as samples: kept where the mint matches the registry, dropped (and named) where it does not. */
export function samplesOf(read: PreStocksRead): { kept: PreStocksSample[]; dropped: string[]; missing: TickerSymbol[] } {
  const kept: PreStocksSample[] = [];
  const dropped: string[] = [];
  const missing: TickerSymbol[] = [];
  for (const { symbol, mint } of NAMES) {
    const row = read.tokens.get(symbol);
    if (!row) {
      missing.push(symbol);
      continue;
    }
    if (row.mint !== mint) {
      dropped.push(`${symbol} mint ${row.mint} is not the registry's ${mint}`);
      continue;
    }
    kept.push({ symbol, mint, tokenPriceE8: row.tokenPriceE8, markPriceE8: row.markPriceE8, fetchedAtSec: read.fetchedAtSec });
  }
  return { kept, dropped, missing };
}

export function createPreStocksSpotFeed(input: { log: (why: string) => void; read?: () => Promise<PreStocksRead> }): PreStocksSpotHandle {
  const read = input.read ?? (() => fetchPreStocks());
  const history = new Map<TickerSymbol, PreStocksSample[]>();
  const listeners = new Set<(sample: PreStocksSample) => void>();
  const beat = registerHeartbeat("prestocks-spot", false, PRESTOCKS_SPOT_EVERY_MS);
  let stopped = false;
  let loggedFailure = false;
  let loggedDrop = "";

  const push = (sample: PreStocksSample) => {
    const list = history.get(sample.symbol) ?? [];
    list.push(sample);
    while (list.length && list[0]!.fetchedAtSec < sample.fetchedAtSec - KEEP_SEC) list.shift();
    history.set(sample.symbol, list);
    for (const listener of listeners) listener(sample);
  };

  async function poll(): Promise<void> {
    while (!stopped) {
      const started = Date.now();
      try {
        const { kept, dropped, missing } = samplesOf(await read());
        for (const sample of kept) push(sample);
        // A mint mismatch is worth one log line per distinct message, not one per poll.
        const drop = dropped.join("; ");
        if (drop && drop !== loggedDrop) input.log(`prestocks-spot dropped: ${drop}`);
        loggedDrop = drop;
        beat.lastOkMs = beat.lastPassMs = Date.now();
        beat.failures = 0;
        beat.lastWhy = `${kept.length}/${NAMES.length} names priced${missing.length ? ` (missing ${missing.join(",")})` : ""}${dropped.length ? ` (dropped ${dropped.length})` : ""}`;
        beat.detail = Object.fromEntries([...history].map(([s, list]) => [s, { token: list.at(-1)!.tokenPriceE8.toString(), mark: list.at(-1)!.markPriceE8.toString() }]));
        loggedFailure = false;
      } catch (error) {
        beat.failures += 1;
        beat.lastPassMs = Date.now();
        beat.lastWhy = `PreStocks catalogue failed: ${errorText(error)} (next read in ${Math.round(nextDelayMs(beat.failures) / 1000)} s)`;
        if (!loggedFailure) input.log(beat.lastWhy);
        loggedFailure = true;
      }
      // A failed read (a 429 above all) waits longer each time; a good one returns to the base poll.
      await sleep(Math.max(0, nextDelayMs(beat.failures) - (Date.now() - started)));
    }
  }

  const feed: PreStocksSpotHandle = {
    latest(symbol, maxAgeSec = 30) {
      const last = history.get(symbol)?.at(-1);
      return last && Math.floor(Date.now() / 1000) - last.fetchedAtSec <= maxAgeSec ? last : null;
    },
    at(symbol, sec, windowSec = 15) {
      const list = history.get(symbol) ?? [];
      for (let i = list.length - 1; i >= 0; i--) {
        const s = list[i]!;
        if (s.fetchedAtSec <= sec) return s.fetchedAtSec >= sec - windowSec ? s : null;
      }
      return null;
    },
    history: (symbol) => history.get(symbol) ?? [],
    symbols: () => NAMES.map((n) => n.symbol),
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

const asSpot = (s: PreStocksSample): SpotQuote => ({ symbol: s.symbol, priceE8: s.tokenPriceE8, publishTimeSec: s.fetchedAtSec, source: "prestocks" });

/** One `SpotFeed` over both: pre-IPO tickers read the PreStocks catalogue, every other symbol reads `base`. */
export function joinPreStocksSpot(base: SpotFeed | null, prestocks: PreStocksSpotFeed): SpotFeed {
  return {
    latest(symbol, maxAgeSec) {
      if (!isPreIpo(symbol)) return base?.latest(symbol, maxAgeSec) ?? null;
      const s = prestocks.latest(symbol, maxAgeSec);
      return s ? asSpot(s) : null;
    },
    subscribe(listener) {
      const offBase = base?.subscribe(listener);
      const offPre = prestocks.subscribe((s) => listener(asSpot(s)));
      return () => {
        offBase?.();
        offPre();
      };
    },
  };
}
