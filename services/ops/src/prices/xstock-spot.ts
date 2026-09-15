/**
 * The token lane's chart spot (session-lanes.md §2.4): Jupiter Price v3 `usdPrice` for the four verified xStock mints
 * every 5 s (keyless 0.5 RPS), per UI token, × 10⁸ floored. Labelled "chart follows Jupiter"; it never settles
 * anything. It also keeps two hours of samples, so the token maker can read the spot at a Window's start and the opt-in
 * attested fallback can read its T − 40 / T − 20 / T samples. `joinXStockSpot` publishes it under the xStock symbols of
 * the process `SpotFeed` (source `"jupiter"`), which the Gap maker reads as its weekend reference. Lane 6b owns this file.
 */
import { TICKERS, TOKEN_LANE_TICKERS, XSTOCK_SYMBOLS, type XStockSymbol } from "@agari/core/market";
import { fetchJupiterPrices } from "@agari/markets/ops/prints";
import { errorText } from "../runtime/env";
import { registerHeartbeat } from "../runtime/heartbeat";
import type { SpotFeed, SpotQuote } from "./spot";

export interface XStockSpotQuote {
  xstock: XStockSymbol;
  priceE8: bigint;
  /** Wall second the sample was taken (Jupiter carries a block, not a time). */
  sampledSec: number;
  source: "jupiter";
}

export interface XStockSpotFeed {
  /** The latest sample, or null when none is fresher than `maxAgeSec` (default 30). */
  latest(xstock: XStockSymbol, maxAgeSec?: number): XStockSpotQuote | null;
  /** The newest sample taken in `[sec − windowSec, sec]` (default 5 s), or null. */
  at(xstock: XStockSymbol, sec: number, windowSec?: number): XStockSpotQuote | null;
  subscribe(listener: (quote: XStockSpotQuote) => void): () => void;
}

export interface XStockSpotHandle extends XStockSpotFeed {
  start(): void;
  stop(): void;
}

const EVERY_MS = 5_000;
const KEEP_SEC = 2 * 3_600;
const MINTS = TOKEN_LANE_TICKERS.map((symbol) => TICKERS[symbol].xstock!).map((x) => ({ xstock: x.symbol, mint: String(x.mint) }));

let current: XStockSpotFeed | null = null;
/** The running feed in this process, for the token maker and the attested fallback; null until one starts. */
export const currentXStockSpot = (): XStockSpotFeed | null => current;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createXStockSpotFeed(input: { log: (why: string) => void; apiKey?: string }): XStockSpotHandle {
  const history = new Map<XStockSymbol, XStockSpotQuote[]>();
  const listeners = new Set<(q: XStockSpotQuote) => void>();
  const beat = registerHeartbeat("xstock-spot", false, EVERY_MS);
  let stopped = false;
  let loggedFailure = false;

  const push = (quote: XStockSpotQuote) => {
    const list = history.get(quote.xstock) ?? [];
    list.push(quote);
    while (list.length && list[0]!.sampledSec < quote.sampledSec - KEEP_SEC) list.shift();
    history.set(quote.xstock, list);
    for (const listener of listeners) listener(quote);
  };

  async function poll(): Promise<void> {
    while (!stopped) {
      const started = Date.now();
      try {
        const prices = await fetchJupiterPrices(MINTS.map((m) => m.mint), { apiKey: input.apiKey });
        const sampledSec = Math.floor(Date.now() / 1000);
        for (const { xstock, mint } of MINTS) {
          const price = prices.get(mint);
          if (price) push({ xstock, priceE8: price.usdPriceE8, sampledSec, source: "jupiter" });
        }
        beat.lastOkMs = beat.lastPassMs = Date.now();
        beat.failures = 0;
        beat.lastWhy = `${prices.size}/${MINTS.length} mints priced`;
        beat.detail = Object.fromEntries([...history].map(([x, list]) => [x, list.at(-1)!.priceE8.toString()]));
        loggedFailure = false;
      } catch (error) {
        beat.failures += 1;
        beat.lastPassMs = Date.now();
        beat.lastWhy = `Jupiter Price v3 failed: ${errorText(error)}`;
        if (!loggedFailure) input.log(beat.lastWhy);
        loggedFailure = true;
      }
      await sleep(Math.max(0, EVERY_MS - (Date.now() - started)));
    }
  }

  const feed: XStockSpotHandle = {
    latest(xstock, maxAgeSec = 30) {
      const last = history.get(xstock)?.at(-1);
      return last && Math.floor(Date.now() / 1000) - last.sampledSec <= maxAgeSec ? last : null;
    },
    at(xstock, sec, windowSec = 5) {
      const list = history.get(xstock) ?? [];
      for (let i = list.length - 1; i >= 0; i--) {
        const q = list[i]!;
        if (q.sampledSec <= sec) return q.sampledSec >= sec - windowSec ? q : null;
      }
      return null;
    },
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

const isXStock = (symbol: string): symbol is XStockSymbol => (XSTOCK_SYMBOLS as readonly string[]).includes(symbol);
const asSpot = (q: XStockSpotQuote): SpotQuote => ({ symbol: q.xstock, priceE8: q.priceE8, publishTimeSec: q.sampledSec, source: "jupiter" });

/** One `SpotFeed` over both: xStock symbols read Jupiter, every other symbol reads `base` (the relay's Pyth/RedStone feed). */
export function joinXStockSpot(base: SpotFeed | null, xstock: XStockSpotFeed): SpotFeed {
  return {
    latest(symbol, maxAgeSec) {
      if (!isXStock(symbol)) return base?.latest(symbol, maxAgeSec) ?? null;
      const q = xstock.latest(symbol, maxAgeSec);
      return q ? asSpot(q) : null;
    },
    subscribe(listener) {
      const offBase = base?.subscribe(listener);
      const offXStock = xstock.subscribe((q) => listener(asSpot(q)));
      return () => {
        offBase?.();
        offXStock();
      };
    },
  };
}
