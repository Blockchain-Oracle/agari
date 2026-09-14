import { PRICE_POLL_MS, PRICE_STALE_AFTER_MS } from "@agari/core/constants";
import type { TickerSymbol } from "@agari/core/market";
import { ok, stale, type Reading } from "@agari/core/schemas";
import type { AssetPrice } from "@agari/core/types";
import { secToMs } from "@agari/core/units";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { nowMs } from "../provider/clock";
import { getAssetPrice } from "../provider/reads";
import { spotView, subscribeSpot } from "../runtime/spot-stream";
import { keys } from "./keys";
import { useReadingQuery } from "./useReadingQuery";
import { useTick } from "./useTick";

const AGE_TICK_MS = 1_000;
const NOT_LIVE = { tick: null, live: false } as const;

/**
 * Spot for one ticker: the tab's one shared stream while it is live, the polled `/prices/latest` snapshot otherwise.
 * Either way a price older than the freshness budget is flagged stale, re-evaluated every second without a new tick.
 */
export function useAssetPrice(asset: TickerSymbol | null): Reading<AssetPrice | null> | null {
  const subscribe = useCallback((onChange: () => void) => (asset === null ? () => undefined : subscribeSpot(asset, onChange)), [asset]);
  const view = useSyncExternalStore(subscribe, () => (asset === null ? NOT_LIVE : spotView(asset)), () => NOT_LIVE);
  const fallback = useReadingQuery(keys.assetPrice(asset), () => getAssetPrice(asset as TickerSymbol), {
    enabled: asset !== null && !(view.live && view.tick),
    pollMs: PRICE_POLL_MS,
    needs: [],
  });
  const tick = useTick(AGE_TICK_MS);

  return useMemo(() => {
    if (asset === null) return null;
    const live = view.live && view.tick ? view.tick : null;
    const price: AssetPrice | null = live
      ? { asset, priceRaw: live.priceE8, emaRaw: live.priceE8, decimals: 8, publishTimeSec: live.publishTimeSec }
      : fallback && fallback.ok
        ? fallback.value
        : null;
    if (!price) return fallback;
    const reading = live ? ok(price, nowMs()) : (fallback as Reading<AssetPrice | null>);
    if (!reading.ok) return reading;
    const aged = nowMs() - secToMs(price.publishTimeSec) > PRICE_STALE_AFTER_MS;
    return aged && !reading.stale ? stale(reading, "aged") : reading;
    // `tick` re-evaluates the age every second without a new feed event.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset, view, fallback, tick]);
}
