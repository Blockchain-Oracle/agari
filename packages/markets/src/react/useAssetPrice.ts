import { PRICE_POLL_MS, PRICE_STALE_AFTER_MS } from "@agari/core/constants";
import type { TickerSymbol } from "@agari/core/market";
import { stale, type Reading } from "@agari/core/schemas";
import type { AssetPrice } from "@agari/core/types";
import { secToMs } from "@agari/core/units";
import { useMemo } from "react";
import { nowMs } from "../provider/clock";
import { getAssetPrice } from "../provider/reads";
import { keys } from "./keys";
import { useReadingQuery } from "./useReadingQuery";
import { useTick } from "./useTick";

const AGE_TICK_MS = 1_000;

/**
 * Spot for one ticker, polled (price-relay's SSE feed replaces the poll in S3). Either way a price older than the
 * freshness budget is flagged stale, re-evaluated every second without a new tick.
 */
export function useAssetPrice(asset: TickerSymbol | null): Reading<AssetPrice | null> | null {
  const reading = useReadingQuery(keys.assetPrice(asset), () => getAssetPrice(asset as TickerSymbol), {
    enabled: asset !== null,
    pollMs: PRICE_POLL_MS,
    needs: [],
  });
  const tick = useTick(AGE_TICK_MS);

  return useMemo(() => {
    if (asset === null || !reading || !reading.ok || !reading.value) return reading;
    const aged = nowMs() - secToMs(reading.value.publishTimeSec) > PRICE_STALE_AFTER_MS;
    return aged && !reading.stale ? stale(reading, "aged") : reading;
    // `tick` re-evaluates the age every second.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, reading, tick]);
}
