"use client";

import { mapReading, stale, type Reading } from "@masayume/core/schemas";
import type { AssetPrice, EventMarket, PricePoint } from "@masayume/core/types";
import { useAssetPrice, usePriceHistory } from "@masayume/markets/react";
import { useEffect, useMemo, useState } from "react";
import { basisRaw, FEED_DECIMALS_DEFAULT, feedRawToOracleRaw } from "./units";

const HISTORY_LEAD_SEC = 60;

/** One chart sample in the oracle's cents scale. */
export interface ChartPoint {
  timeSec: number;
  valueRaw: bigint;
}

export interface ChartSeries {
  points: ChartPoint[];
  latest: ChartPoint | null;
  feedDecimals: number;
}

function toChartPoint(point: PricePoint | AssetPrice, feedDecimals: number): ChartPoint {
  return { timeSec: point.blockTimestampSec, valueRaw: feedRawToOracleRaw(basisRaw(point), feedDecimals) };
}

/** lightweight-charts needs strictly ascending, unique times; the last sample in a second wins. */
function dedupeByTime(points: ChartPoint[]): ChartPoint[] {
  const byTime = new Map<number, ChartPoint>();
  for (const point of points) byTime.set(point.timeSec, point);
  return [...byTime.values()].sort((a, b) => a.timeSec - b.timeSec);
}

/**
 * History from a minute before the window opened, then live ticks appended; both on
 * the settlement basis (Story 1.4).
 *
 * `null` is a valid market: both underlying reads gate on their own `enabled`, so a
 * caller with nothing selected yet (Sensei, before a lane lands) holds the hook
 * without fetching, rather than passing a fabricated market to keep the count.
 */
export function useChartSeries(market: EventMarket | null): Reading<ChartSeries> | null {
  const fromSec = (market?.tradingStartSec ?? 0) - HISTORY_LEAD_SEC;
  const history = usePriceHistory(market?.asset ?? null, fromSec, market?.expirySec ?? 0);
  const live = useAssetPrice(market?.asset ?? null);
  const [liveTicks, setLiveTicks] = useState<ChartPoint[]>([]);

  useEffect(() => setLiveTicks([]), [market?.marketId]);

  useEffect(() => {
    if (!live?.ok || !live.value) return;
    const tick = toChartPoint(live.value, live.value.decimals);
    setLiveTicks((prev) => {
      const last = prev.at(-1);
      return !last || tick.timeSec > last.timeSec ? [...prev, tick] : prev;
    });
  }, [live]);

  return useMemo(() => {
    if (history === null) return null;
    const feedDecimals = live?.ok && live.value ? live.value.decimals : FEED_DECIMALS_DEFAULT;
    const merged = mapReading(history, (points) => {
      const all = dedupeByTime([...points.map((p) => toChartPoint(p, feedDecimals)), ...liveTicks]).filter((p) => p.timeSec >= fromSec);
      return { points: all, latest: all.at(-1) ?? null, feedDecimals };
    });
    if (!merged.ok || live === null) return merged;
    if (!live.ok) return stale(merged, "refresh-failed");
    return live.stale ? stale(merged, live.staleReason ?? "aged") : merged;
  }, [history, live, liveTicks, fromSec]);
}
