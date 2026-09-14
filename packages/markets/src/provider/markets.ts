/**
 * Window lists and rows from the indexer (first-call.md §2.2): lanes, one Window, several Windows, settled Windows,
 * the successor Window and a lane's next start. The chain facts a row lacks (collateral, decimals, a not-yet-printed
 * Window's primary source) are read alongside the index fetch, never after it, and are cached for the runtime's life.
 */
import { groupIntoLanes } from "@agari/core/market";
import type { Reading } from "@agari/core/schemas";
import type { Address, EventMarket, LaneSet, MarketId, Resolution } from "@agari/core/types";
import { readSeries, readVenueStatic, type SeriesFacts, type VenueFacts } from "../runtime/accounts";
import { nowSec } from "./clock";
import { indexRows, type MarketRow } from "./index-api";
import { rememberOpeningPrint } from "./opening-prints";
import { withReading } from "./reading";
import { isListable, PRINT, toEventMarket, toResolution } from "./rows";

const LIVE_LIMIT = 300;
const SETTLED_PAGE = 50;
const SUCCESSOR_LIMIT = 20;

/** Series policies only for rows that still need one (no opening print yet), in one batched account read. */
async function seriesFor(rows: readonly MarketRow[]): Promise<Map<string, SeriesFacts>> {
  // Every listed Series is warmed in the same batch (cached forever), so a later snapshot or quote never waits on one.
  for (const series of new Set(rows.map((row) => row.series))) if (series) void readSeries(series as Address).catch(() => null);
  const needed = [...new Set(rows.filter((row) => !row.prints?.[PRINT.open] && row.series).map((row) => row.series as string))];
  const facts = await Promise.all(needed.map((series) => readSeries(series as Address).catch(() => null)));
  return new Map(needed.flatMap((series, i) => (facts[i] ? [[series, facts[i]] as const] : [])));
}

async function toMarkets(rows: readonly MarketRow[], venue: VenueFacts): Promise<EventMarket[]> {
  const listable = rows.filter(isListable);
  const series = await seriesFor(listable);
  const now = nowSec();
  return listable.map((row) => {
    const market = toEventMarket(row, venue, series.get(row.series ?? "") ?? null, now);
    if (market.openingPriceRaw !== null) rememberOpeningPrint(market.marketId, market.openingPriceRaw);
    return market;
  });
}

/** Index rows and the venue facts, fetched together. */
async function rowsWithVenue(path: string, query: Record<string, string | number | undefined>): Promise<[MarketRow[], VenueFacts]> {
  return Promise.all([indexRows<MarketRow>(path, query), readVenueStatic()]);
}

export async function listLiveLanes(venueId: Address): Promise<Reading<LaneSet>> {
  return withReading(`lanes:${venueId}`, async () => {
    // Floored to 5 s so the URL (and the route's 2 s shared cache) holds between a tab's polls and across tabs.
    const expiryFrom = Math.floor(nowSec() / 5) * 5;
    const [rows, venue] = await rowsWithVenue("markets", { state: "open", expiryFrom, limit: LIVE_LIMIT });
    return groupIntoLanes(await toMarkets(rows, venue), venueId);
  });
}

export async function getMarket(marketId: MarketId): Promise<Reading<EventMarket | null>> {
  return withReading(`market:${marketId}`, async () => {
    const [rows, venue] = await rowsWithVenue(`markets/${marketId}`, {});
    return (await toMarkets(rows, venue))[0] ?? null;
  });
}

/** Labels and expiries for several Windows in one index query. */
export async function getMarketsLite(marketIds: readonly MarketId[]): Promise<Reading<Map<MarketId, EventMarket>>> {
  return withReading(`marketsLite:${marketIds.join(",")}`, async () => {
    if (marketIds.length === 0) return new Map();
    const [rows, venue] = await rowsWithVenue("markets", { ids: marketIds.join(",") });
    return new Map((await toMarkets(rows, venue)).map((market) => [market.marketId, market]));
  });
}

/** Recent terminal Windows, expiry descending. A page, so no money figure may depend on it (NFR-4). */
export async function listSettled(venueId: Address, limit = SETTLED_PAGE): Promise<Reading<EventMarket[]>> {
  return withReading(`settled:${venueId}:${limit}`, async () => {
    const [rows, venue] = await rowsWithVenue("markets", { settled: 1, limit });
    return (await toMarkets(rows, venue)).sort((a, b) => b.expirySec - a.expirySec);
  });
}

/** The same Series' next Window (Ticket auto-advance, dead deep links). */
export async function nextWindow(market: EventMarket): Promise<Reading<EventMarket | null>> {
  return withReading(`next:${market.marketId}`, async () => {
    const [rows, venue] = await rowsWithVenue("markets", { series: market.seriesAddress, expiryFrom: market.expirySec + 1, limit: SUCCESSOR_LIMIT });
    const successors = (await toMarkets(rows, venue)).sort((a, b) => a.expirySec - b.expirySec);
    return successors[0] ?? null;
  });
}

/** Next start for an empty lane: Windows are contiguous, so it is the cadence's latest expiry. */
export async function laneNextStart(_venueId: Address, intervalSec: number): Promise<Reading<number | null>> {
  return withReading(`laneNext:${intervalSec}`, async () => {
    const rows = await indexRows<MarketRow>("markets", { limit: LIVE_LIMIT });
    const latest = rows.filter((row) => isListable(row) && row.cadence_sec === intervalSec)[0];
    return latest ? Number(latest.expiry_sec) : null;
  });
}

/** How a Window settled, from its index row; an open Window reads all nulls. */
export async function getResolution(marketId: MarketId): Promise<Reading<Resolution>> {
  return withReading(`resolution:${marketId}`, async () => toResolution((await indexRows<MarketRow>(`markets/${marketId}`))[0] ?? null));
}

/** The index row itself, for reads that fall back to it when the Market account is gone. */
export async function marketRow(marketId: MarketId): Promise<MarketRow | null> {
  return (await indexRows<MarketRow>(`markets/${marketId}`))[0] ?? null;
}
