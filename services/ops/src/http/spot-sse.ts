/**
 * `GET /prices/latest` and `GET /prices/stream` (venue-ops.md §6.5; D-086). Row shape:
 * `{ symbol, priceE8, publishTimeSec, source, ageSec, fresh }`. A symbol is never dropped: a quote older than the
 * freshness budget stays with `fresh: false`, and when the in-memory feed holds nothing for it (an overnight restart)
 * the newest `print_archive` row is served as `source: "archive"`, so a last close always exists.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { TICKER_SYMBOLS, TICKERS, type TickerSymbol, type XStockSymbol } from "@agari/core/market";
import { latestArchivedPrints, type PrintArchiveSource } from "@agari/db";
import type { SpotFeed, SpotQuote } from "../prices/spot";

/** A quote this old or younger is `fresh` (D-086). */
export const FRESH_MAX_AGE_SEC = 60;
/** One archive read serves every request in a minute: the archive only moves at 5-minute boundaries. */
const ARCHIVE_MEMO_MS = 60_000;
const KEEPALIVE_MS = 15_000;

export interface WireQuote {
  /** A ticker, or an xStock the token lane's spot ticks for (S6); the archive fallback covers tickers only. */
  symbol: TickerSymbol | XStockSymbol;
  priceE8: string;
  publishTimeSec: number;
  source: SpotQuote["source"] | "archive";
  ageSec: number;
  fresh: boolean;
}

export interface ArchiveLatest {
  priceE8: string;
  boundarySec: number;
}

/** The newest archived price per symbol, for the symbols the feed has nothing on. */
export type ArchiveReader = (symbols: readonly TickerSymbol[]) => Promise<ReadonlyMap<TickerSymbol, ArchiveLatest>>;

export interface LatestOptions {
  nowSec?: number;
  archive?: ArchiveReader;
}

const wallSec = () => Math.floor(Date.now() / 1000);

function toWire(symbol: WireQuote["symbol"], priceE8: string, publishTimeSec: number, source: WireQuote["source"], nowSec: number): WireQuote {
  const ageSec = Math.max(0, nowSec - publishTimeSec);
  return { symbol, priceE8, publishTimeSec, source, ageSec, fresh: ageSec <= FRESH_MAX_AGE_SEC };
}

const wire = (q: SpotQuote, nowSec: number) => toWire(q.symbol, q.priceE8.toString(), q.publishTimeSec, q.source, nowSec);

/** The archive keys a ticker's prints are stored under: RedStone by ticker, Pyth by lower-case feed id without `0x`. */
function archiveKeys(symbol: TickerSymbol): Array<{ source: PrintArchiveSource; feed: string }> {
  const t = TICKERS[symbol];
  return [
    ...(t.redstoneFeedId ? [{ source: "redstone" as const, feed: t.redstoneFeedId }] : []),
    { source: "pyth" as const, feed: t.pythFeedId.toLowerCase().replace(/^0x/, "") },
  ];
}

let archiveMemo: { atMs: number; symbols: string; rows: Promise<ReadonlyMap<TickerSymbol, ArchiveLatest>> } | null = null;

/** The db-backed reader, memoized per symbol set; a failed or absent database reads as "nothing archived". */
export const readArchiveLatest: ArchiveReader = (symbols) => {
  const key = symbols.join(",");
  const now = Date.now();
  if (archiveMemo && archiveMemo.symbols === key && now - archiveMemo.atMs < ARCHIVE_MEMO_MS) return archiveMemo.rows;
  const rows = (async () => {
    const out = new Map<TickerSymbol, ArchiveLatest>();
    const keys = symbols.flatMap(archiveKeys);
    const found = await latestArchivedPrints(keys).catch(() => null);
    for (const symbol of symbols) {
      for (const k of archiveKeys(symbol)) {
        const row = found?.find((r) => r.source === k.source && r.feed === k.feed);
        if (!row) continue;
        const have = out.get(symbol);
        if (!have || row.boundarySec > have.boundarySec) out.set(symbol, { priceE8: row.priceE8, boundarySec: row.boundarySec });
      }
    }
    return out;
  })();
  archiveMemo = { atMs: now, symbols: key, rows };
  return rows;
};

/** Every symbol with a price: the fresh quote, else the aged one, else the newest archived print. Absent only when nothing is known anywhere. */
export async function latestQuotes(spot: SpotFeed, { nowSec = wallSec(), archive = readArchiveLatest }: LatestOptions = {}): Promise<WireQuote[]> {
  const out: WireQuote[] = [];
  const missing: TickerSymbol[] = [];
  for (const symbol of TICKER_SYMBOLS) {
    // Fresh first (Pyth wins when both are fresh), then anything the feed has ever seen.
    const q = spot.latest(symbol, FRESH_MAX_AGE_SEC) ?? spot.latest(symbol, Number.POSITIVE_INFINITY);
    if (q) out.push(wire(q, nowSec));
    else missing.push(symbol);
  }
  if (missing.length === 0) return out;
  // The archive is a fallback, never a gate: a failed read leaves the live rows as they are.
  const archived = await archive(missing).catch(() => new Map<TickerSymbol, ArchiveLatest>());
  for (const symbol of missing) {
    const row = archived.get(symbol);
    if (row) out.push(toWire(symbol, row.priceE8, row.boundarySec, "archive", nowSec));
  }
  return out;
}

export async function latestBody(spot: SpotFeed, options?: LatestOptions): Promise<Record<string, Omit<WireQuote, "symbol">>> {
  const out: Record<string, Omit<WireQuote, "symbol">> = {};
  for (const { symbol, ...rest } of await latestQuotes(spot, options)) out[symbol] = rest;
  return out;
}

export async function streamSpot(req: IncomingMessage, res: ServerResponse, spot: SpotFeed, headers: Record<string, string>): Promise<void> {
  res.writeHead(200, { ...headers, "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
  const send = (q: WireQuote) => res.write(`event: spot\ndata: ${JSON.stringify(q)}\n\n`);
  // The snapshot is the same set `/prices/latest` serves, so a tab opening overnight is never empty.
  for (const q of await latestQuotes(spot)) send(q);
  const unsubscribe = spot.subscribe((q) => send(wire(q, wallSec())));
  const keepalive = setInterval(() => res.write(": keepalive\n\n"), KEEPALIVE_MS);
  req.on("close", () => {
    clearInterval(keepalive);
    unsubscribe();
  });
}
