import { PRICE_POLL_MS, PRICE_STALE_AFTER_MS } from "@masayume/core/constants";
import { ok, stale, type Reading } from "@masayume/core/schemas";
import type { AssetPrice } from "@masayume/core/types";
import { secToMs } from "@masayume/core/units";
import { useLivePrice, useWatchPrice } from "@somnia-chain/markets-sdk/react";
import { useMemo } from "react";
import { toAssetPrice } from "../mappers/price";
import { nowMs } from "../provider/clock";
import { getAssetPrice } from "../provider/prices";
import { keys } from "./keys";
import { useReadingQuery } from "./useReadingQuery";
import { useTick } from "./useTick";

const AGE_TICK_MS = 1_000;

/** Live feed while the subscription is up, polled snapshot otherwise; either way a tick older than the freshness budget is flagged stale. */
export function useAssetPrice(asset: string | null): Reading<AssetPrice | null> | null {
  const status = useWatchPrice(asset ?? undefined);
  const live = useLivePrice(asset ?? undefined);
  const fallback = useReadingQuery(keys.assetPrice(asset), () => getAssetPrice(asset as string), {
    enabled: asset !== null && status !== "live",
    pollMs: PRICE_POLL_MS,
  });
  const tick = useTick(AGE_TICK_MS);

  return useMemo(() => {
    if (asset === null) return null;
    const price = status === "live" && live ? toAssetPrice(live) : fallback && fallback.ok ? fallback.value : null;
    if (!price) return fallback;
    const reading = ok(price, nowMs());
    const aged = nowMs() - secToMs(price.blockTimestampSec) > PRICE_STALE_AFTER_MS;
    return aged ? stale(reading, "aged") : reading;
    // `tick` re-evaluates the age every second without a new feed event.
  }, [asset, status, live, fallback, tick]);
}
