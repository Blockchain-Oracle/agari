/**
 * The token lane's display spot: the Switchboard Surge job each 24/7 Window's print signs, read unsigned through the
 * crossbar's simulator every 5 s for the verified xStocks. It is what `/prices/latest` and `/prices/stream` publish
 * under the xStock symbols, so the live price beside a 24/7 Window is on the scale it settles on. Jupiter's last swap
 * sat 10–60 bps under it (09-24: QQQx $736.33 at a bell that printed $738.86), enough to show a winning call as losing.
 *
 * Only the HTTP server reads it. The token maker keeps `xstock-spot`: it measures a Window's move within one source,
 * where the cross-source basis cancels. When the crossbar fails the last reading stays and ages out as not fresh; it
 * never falls back to Jupiter, whose level is the very gap this closes.
 */
import { TICKERS, TOKEN_LANE_TICKERS, XSTOCK_SYMBOLS, type XStockSymbol } from "@agari/core/market";
import { simulateSurgeE8 } from "@agari/markets/ops/prints";
import { errorText } from "../runtime/env";
import { registerHeartbeat } from "../runtime/heartbeat";
import type { SpotFeed, SpotQuote } from "./spot";

const EVERY_MS = 5_000;
const FEEDS = TOKEN_LANE_TICKERS.map((symbol) => TICKERS[symbol].xstock!).map((x) => ({ xstock: x.symbol, surge: x.surgeSymbol }));

export interface SwitchboardSpotHandle {
  latest(xstock: XStockSymbol, maxAgeSec?: number): SpotQuote | null;
  subscribe(listener: (quote: SpotQuote) => void): () => void;
  start(): void;
  stop(): void;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function createSwitchboardSpotFeed(input: { log: (why: string) => void }): SwitchboardSpotHandle {
  const last = new Map<XStockSymbol, SpotQuote>();
  const listeners = new Set<(q: SpotQuote) => void>();
  const beat = registerHeartbeat("switchboard-spot", false, EVERY_MS);
  let stopped = false;
  let loggedFailure = false;

  async function poll(): Promise<void> {
    while (!stopped) {
      const started = Date.now();
      const reads = await Promise.allSettled(FEEDS.map((f) => simulateSurgeE8(f.surge)));
      const sampledSec = Math.floor(Date.now() / 1000);
      const failed: string[] = [];
      reads.forEach((read, i) => {
        const { xstock } = FEEDS[i]!;
        if (read.status === "rejected") return void failed.push(`${xstock}: ${errorText(read.reason)}`);
        const quote: SpotQuote = { symbol: xstock, priceE8: read.value, publishTimeSec: sampledSec, source: "switchboard" };
        last.set(xstock, quote);
        for (const listener of listeners) listener(quote);
      });
      beat.lastPassMs = Date.now();
      if (failed.length < FEEDS.length) beat.lastOkMs = beat.lastPassMs;
      beat.failures = failed.length === FEEDS.length ? beat.failures + 1 : 0;
      beat.lastWhy = failed.length ? `crossbar: ${failed.length}/${FEEDS.length} failed (${failed[0]})` : `${FEEDS.length}/${FEEDS.length} Surge feeds read`;
      beat.detail = Object.fromEntries([...last].map(([x, q]) => [x, q.priceE8.toString()]));
      if (failed.length && !loggedFailure) input.log(beat.lastWhy);
      loggedFailure = failed.length > 0;
      await sleep(Math.max(0, EVERY_MS - (Date.now() - started)));
    }
  }

  return {
    latest(xstock, maxAgeSec = 30) {
      const q = last.get(xstock);
      return q && Math.floor(Date.now() / 1000) - q.publishTimeSec <= maxAgeSec ? q : null;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start() {
      beat.lastWhy = "polling";
      void poll();
    },
    stop() {
      stopped = true;
    },
  };
}

const isXStock = (symbol: string): symbol is XStockSymbol => (XSTOCK_SYMBOLS as readonly string[]).includes(symbol);

/** `base` with the xStock symbols read from Switchboard (display); every other symbol, and every subscriber of `base`, unchanged. */
export function joinSwitchboardSpot(base: SpotFeed | null, switchboard: SwitchboardSpotHandle): SpotFeed {
  return {
    latest(symbol, maxAgeSec) {
      return isXStock(symbol) ? switchboard.latest(symbol, maxAgeSec) : (base?.latest(symbol, maxAgeSec) ?? null);
    },
    subscribe(listener) {
      // The base's own xStock ticks (Jupiter) would interleave a second level on the same symbol: only Switchboard's pass.
      const offBase = base?.subscribe((q) => (isXStock(q.symbol) ? undefined : listener(q)));
      const offSwitchboard = switchboard.subscribe(listener);
      return () => {
        offBase?.();
        offSwitchboard();
      };
    },
  };
}
