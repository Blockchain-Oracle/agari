import { groupIntoLanes } from "@masayume/core/market";
import type { Reading } from "@masayume/core/schemas";
import { toMarketId, type Bytes32, type EventMarket, type IndexedStatus, type LaneSet, type MarketId } from "@masayume/core/types";
import type { BinaryMarket } from "@somnia-chain/markets-sdk";
import { getClient } from "../runtime/read-runtime";
import { toEventMarket } from "../mappers/market";
import { nowSec } from "./clock";
import { fetchOpeningPrices } from "./prices";
import { withReading } from "./reading";

const LIVE_PAGE = 100;
const SETTLED_PAGE = 50;
export const SETTLED_STATUSES: ReadonlySet<IndexedStatus> = new Set<IndexedStatus>(["Resolved", "Voided", "Finalized"]);

async function withOpeningPrices(rows: readonly BinaryMarket[]): Promise<EventMarket[]> {
  const ids = rows.map((row) => toMarketId(row.marketId));
  const prints = await fetchOpeningPrices(ids);
  return rows.map((row, i) => toEventMarket(row, prints.get(ids[i] as MarketId) ?? null));
}

export async function listLiveLanes(venueId: Bytes32): Promise<Reading<LaneSet>> {
  return withReading(`lanes:${venueId}`, async () => {
    const rows = await getClient().listLiveBinaryMarkets({ venueId, limit: LIVE_PAGE, nowSec: nowSec() });
    return groupIntoLanes(await withOpeningPrices(rows), venueId);
  });
}

/**
 * Several Windows by id in one round, without their opening prints — labels and expiries only, for a table
 * that names ten settled Windows and for the withdraw guard that must see every open one. `getMarket` fetches a
 * print per call, which made a ten-row table resolve one row a second (found in a browser 2026-09-03, context/49).
 */
export async function getMarketsLite(marketIds: readonly MarketId[]): Promise<Reading<Map<MarketId, EventMarket>>> {
  return withReading(`marketsLite:${marketIds.join(",")}`, async () => {
    const rows = await Promise.all(marketIds.map((id) => getClient().getBinaryMarket(id)));
    const out = new Map<MarketId, EventMarket>();
    rows.forEach((row, i) => {
      if (row) out.set(marketIds[i] as MarketId, toEventMarket(row, null));
    });
    return out;
  });
}

export async function getMarket(marketId: MarketId): Promise<Reading<EventMarket | null>> {
  return withReading(`market:${marketId}`, async () => {
    const row = await getClient().getBinaryMarket(marketId);
    if (!row) return null;
    return (await withOpeningPrices([row]))[0] ?? null;
  });
}

/**
 * Recent settled markets for history surfaces, via the past list rather than the registry sweep that hides
 * finalized markets (canon #10); sorted by expiry locally. A page, so no money figure may depend on it (NFR-4).
 */
export async function listSettled(venueId: Bytes32, limit = SETTLED_PAGE): Promise<Reading<EventMarket[]>> {
  return withReading(`settled:${venueId}:${limit}`, async () => {
    const rows = await getClient().listPastBinaryMarkets({ venueId, limit, nowSec: nowSec() });
    const settled = rows.filter((row) => SETTLED_STATUSES.has(row.status));
    return (await withOpeningPrices(settled)).sort((a, b) => b.expirySec - a.expirySec);
  });
}
