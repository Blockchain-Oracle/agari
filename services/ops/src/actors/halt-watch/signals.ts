/**
 * What halt-watch reads (session-lanes.md §3.1), each at the source's own pace:
 * - **Pyth:** Hermes `latest` for the trial feeds (price, conf, publish time) once per pass in regular hours. The spot
 *   stream carries no confidence, so this is its own read (≈ 2.6 KB). `PYTH_API_KEY` rides a Bearer header only.
 * - **RedStone:** the newest package time per feed, from the process's spot feed when price-relay runs (no extra
 *   gateway load), else its own `latest` read every 15 s (≈ 1.9 MB).
 * - **xStocks:** `system/status/<xStock>` every 60 s, keyless (1,000 calls/min allowed; this makes 4).
 * A failed read keeps the last observation, so a source that stays unreadable ages into a stale halt on its own.
 */
import { readFileSync } from "node:fs";
import { TICKER_SYMBOLS, XSTOCK_SYMBOLS, type PythTick, type SourceVersion, type TickerSymbol, type XStockSymbol } from "@agari/core/market";
import type { PrintSource } from "@agari/core/types";
import type { SpotFeed } from "../../prices/spot";
import { HERMES, parsePythEntries } from "../price-relay/hermes-fetch";
import { fetchRedstoneLatest, latestMedian } from "../price-relay/redstone-fetch";
import type { RelaySources } from "../price-relay/sources";

const CONFIG_URL = new URL("../../../config/price-sources.json", import.meta.url);
const XSTOCKS_API = "https://api.xstocks.fi/api/v2/public";
const TIMEOUT_MS = 8_000;
export const REDSTONE_OWN_READ_MS = 15_000;
export const ISSUER_READ_MS = 60_000;

type RawVersion = { validFrom: string; validUntil: string | null; primary: PrintSource };

/** `tickers.<SYM>.versions` → the dated primaries halts need. */
export function loadSourceVersions(): Partial<Record<TickerSymbol, SourceVersion[]>> {
  const raw = JSON.parse(readFileSync(CONFIG_URL, "utf8")) as { tickers: Record<string, { versions?: RawVersion[] }> };
  const sec = (iso: string) => Date.parse(iso) / 1000;
  return Object.fromEntries(
    TICKER_SYMBOLS.filter((s) => raw.tickers[s]?.versions).map((s) => [
      s,
      raw.tickers[s]!.versions!.map((v) => ({ validFromSec: sec(v.validFrom), validUntilSec: v.validUntil === null ? null : sec(v.validUntil), primary: v.primary })),
    ]),
  );
}

export interface SignalBook {
  pyth: Partial<Record<TickerSymbol, PythTick>>;
  redstoneNewestSec: Partial<Record<TickerSymbol, number>>;
  issuer: Partial<Record<XStockSymbol, boolean>>;
  /** Log-safe notes on failed reads this pass. */
  problems: string[];
}

export const emptySignals = (): SignalBook => ({ pyth: {}, redstoneNewestSec: {}, issuer: {}, problems: [] });

/** Hermes `latest` for the given feeds into `book.pyth`. */
export async function readPyth(book: SignalBook, feeds: RelaySources["pythFeeds"], key: string | undefined): Promise<void> {
  if (feeds.length === 0) return;
  if (!key) return void book.problems.push("pyth: no PYTH_API_KEY");
  const ids = feeds.map((f) => `ids[]=${f.feedIdHex}`).join("&");
  try {
    const res = await fetch(`${HERMES}/v2/updates/price/latest?${ids}&parsed=true`, { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return void book.problems.push(`pyth: Hermes HTTP ${res.status}`);
    const body = (await res.json()) as { parsed?: Parameters<typeof parsePythEntries>[0] };
    const bySymbol = new Map(feeds.map((f) => [f.feedIdHex, f.symbol]));
    for (const p of parsePythEntries(body.parsed ?? [])) {
      const symbol = bySymbol.get(p.feedIdHex);
      const prev = symbol ? book.pyth[symbol] : undefined;
      if (symbol && (!prev || p.publishTimeSec >= prev.publishTimeSec)) book.pyth[symbol] = { price: p.price, conf: p.conf, publishTimeSec: p.publishTimeSec };
    }
  } catch (error) {
    book.problems.push(`pyth: ${error instanceof Error ? error.name : "read failed"}`);
  }
}

/** Keeps `book.redstoneNewestSec` current from the spot feed's RedStone quotes; returns the unsubscribe. */
export function followSpot(book: SignalBook, spot: SpotFeed): () => void {
  return spot.subscribe((quote) => {
    if (quote.source !== "redstone") return;
    book.redstoneNewestSec[quote.symbol] = Math.max(book.redstoneNewestSec[quote.symbol] ?? 0, quote.publishTimeSec);
  });
}

/** One gateway `latest` read into `book.redstoneNewestSec` (used only without a spot feed). */
export async function readRedstone(book: SignalBook, sources: RelaySources): Promise<void> {
  try {
    const { text } = await fetchRedstoneLatest(sources.gateways);
    for (const { symbol, feed } of sources.redstoneFeeds) {
      const newest = latestMedian(text, feed, sources.redstoneSigners)?.publishTimeSec;
      if (newest !== undefined) book.redstoneNewestSec[symbol] = Math.max(book.redstoneNewestSec[symbol] ?? 0, newest);
    }
  } catch {
    book.problems.push("redstone: gateways failed");
  }
}

/** xStocks' own trading-halt flag for each token-lane xStock into `book.issuer`. */
export async function readIssuer(book: SignalBook): Promise<void> {
  await Promise.all(
    XSTOCK_SYMBOLS.map(async (xstock) => {
      try {
        const res = await fetch(`${XSTOCKS_API}/system/status/${xstock}`, { signal: AbortSignal.timeout(TIMEOUT_MS) });
        const body = res.ok ? ((await res.json()) as { symbol?: unknown; isMarketTradingHalted?: unknown }) : null;
        if (body?.symbol === xstock && typeof body.isMarketTradingHalted === "boolean") book.issuer[xstock] = body.isMarketTradingHalted;
        else book.problems.push(`issuer ${xstock}: ${res.ok ? "unexpected body" : `HTTP ${res.status}`}`);
      } catch (error) {
        book.problems.push(`issuer ${xstock}: ${error instanceof Error ? error.name : "read failed"}`);
      }
    }),
  );
}
