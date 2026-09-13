import type { Reading } from "@masayume/core/schemas";
import type { AssetPrice, MarketId, PricePoint } from "@masayume/core/types";
import { getClient } from "../runtime/read-runtime";
import { toAssetPrice, toPricePoint } from "../mappers/price";
import { bigintOf } from "../mappers/scalars";
import { withReading } from "./reading";

const HISTORY_LIMIT = 2_000;
const openingPrints = new Map<string, bigint>();

/** Batched opening prints; a print, once seen, is immutable (FR-7) so non-null values are cached forever. */
export async function fetchOpeningPrices(marketIds: readonly MarketId[]): Promise<Map<MarketId, bigint | null>> {
  const result = new Map<MarketId, bigint | null>();
  const missing = marketIds.filter((id) => !openingPrints.has(id));
  if (missing.length > 0) {
    const fetched = await getClient().getOpeningPrices([...missing]);
    for (const id of missing) {
      const raw = bigintOf(fetched[id] ?? fetched[id.toLowerCase()]);
      if (raw !== null) openingPrints.set(id, raw);
    }
  }
  for (const id of marketIds) result.set(id, openingPrints.get(id) ?? null);
  return result;
}

export async function getOpeningPrice(marketId: MarketId): Promise<Reading<bigint | null>> {
  return withReading(`opening:${marketId}`, async () => (await fetchOpeningPrices([marketId])).get(marketId) ?? null);
}

export async function getAssetPrice(asset: string): Promise<Reading<AssetPrice | null>> {
  return withReading(`price:${asset}`, async () => {
    const live = await getClient().fetchPrice(asset);
    return live ? toAssetPrice(live) : null;
  });
}

export async function getPriceHistory(asset: string, fromSec: number, toSec: number): Promise<Reading<PricePoint[]>> {
  return withReading(`history:${asset}:${fromSec}:${toSec}`, async () => {
    const points = await getClient().fetchPriceHistory(asset, { from: fromSec, to: toSec, limit: HISTORY_LIMIT });
    return points.map(toPricePoint).sort((a, b) => a.blockTimestampSec - b.blockTimestampSec);
  });
}
