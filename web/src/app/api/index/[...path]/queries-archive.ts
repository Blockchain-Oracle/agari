import { TICKERS, tickerSymbolSchema, type TickerSymbol } from "@agari/core/market";
import { z } from "zod";
import { BadRequest, type IndexQuery } from "./queries";

/**
 * `archive/<TICKER>?from&to` (S18 lane 18a, D-086): the signed 5-minute `print_archive` series, one row per boundary
 * (`boundary_sec`, `source`, `price_e8`, `signers`). The archive is append-only and moves every five minutes, so a
 * public answer rides a 60 s shared cache rather than the 2 s every other public query gets.
 */
const ARCHIVE_CACHE = "public, s-maxage=60, stale-while-revalidate=300";
const int = z.coerce.number().int().nonnegative();
const rangeQuery = z.object({ from: int, to: int, limit: int.optional() });

/** The rows a ticker's prints are archived under: RedStone by ticker, Pyth by the lower-case feed id without `0x`. */
export function archiveKeys(symbol: TickerSymbol): Array<{ source: "redstone" | "pyth"; feed: string }> {
  const t = TICKERS[symbol];
  // Each source only where it exists: a pre-IPO name has neither, so its chart reads an empty archive. A valuation
  // lane (S20) is archived under its Pyth index; the pre-IPO name it prices never is.
  const pyth = t.pythFeedId ?? (t.kind === "valuation" ? t.pythIndexFeedId : null);
  return [
    ...(t.redstoneFeedId ? [{ source: "redstone" as const, feed: t.redstoneFeedId }] : []),
    ...(pyth ? [{ source: "pyth" as const, feed: pyth.toLowerCase().replace(/^0x/, "") }] : []),
  ];
}

export function resolveArchiveQuery(path: readonly string[], query: Record<string, string>): IndexQuery | null {
  const [head, second, ...rest] = path;
  if (head !== "archive" || second === undefined || rest.length > 0) return null;
  const symbol = tickerSymbolSchema.safeParse(second);
  if (!symbol.success) throw new BadRequest(`archive: unknown ticker ${second}`);
  const range = rangeQuery.safeParse(query);
  if (!range.success) throw new BadRequest(range.error.issues.map((i) => `${i.path.join(".") || "value"}: ${i.message}`).join("; "));
  if (range.data.to < range.data.from) throw new BadRequest("archive: to is before from");
  const keys = archiveKeys(symbol.data);
  const { from, to, limit } = range.data;
  return { scope: "public", cacheControl: ARCHIVE_CACHE, run: (r) => r.printArchiveSeries(keys, from, to, limit) };
}
