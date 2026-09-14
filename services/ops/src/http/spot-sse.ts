/** `GET /prices/latest` and `GET /prices/stream` (venue-ops.md §6.5). Quote shape: `{ symbol, priceE8, publishTimeSec, source }`. */
import type { IncomingMessage, ServerResponse } from "node:http";
import { TICKER_SYMBOLS } from "@agari/core/market";
import type { SpotFeed, SpotQuote } from "../prices/spot";

const LATEST_MAX_AGE_SEC = 60;
const KEEPALIVE_MS = 15_000;

const wire = (q: SpotQuote) => ({ symbol: q.symbol, priceE8: q.priceE8.toString(), publishTimeSec: q.publishTimeSec, source: q.source });

export function latestBody(spot: SpotFeed) {
  const out: Record<string, Omit<ReturnType<typeof wire>, "symbol">> = {};
  for (const symbol of TICKER_SYMBOLS) {
    const q = spot.latest(symbol, LATEST_MAX_AGE_SEC);
    if (q) {
      const { symbol: _s, ...rest } = wire(q);
      out[symbol] = rest;
    }
  }
  return out;
}

export function streamSpot(req: IncomingMessage, res: ServerResponse, spot: SpotFeed, headers: Record<string, string>): void {
  res.writeHead(200, { ...headers, "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  const send = (q: SpotQuote) => res.write(`event: spot\ndata: ${JSON.stringify(wire(q))}\n\n`);
  for (const symbol of TICKER_SYMBOLS) {
    const q = spot.latest(symbol, LATEST_MAX_AGE_SEC);
    if (q) send(q);
  }
  const unsubscribe = spot.subscribe(send);
  const keepalive = setInterval(() => res.write(": keepalive\n\n"), KEEPALIVE_MS);
  req.on("close", () => {
    clearInterval(keepalive);
    unsubscribe();
  });
}
