import { CLOCK_RESYNC_MS, MARKETS_POLL_MS } from "@masayume/core/constants";
import { combineReadings, isOk, mapReading, type Reading } from "@masayume/core/schemas";
import type { ClockSync } from "@masayume/core/types";
import type { CollateralInfo } from "../collateral";
import type { MarketsEnv } from "../env";
import { mark } from "../perf/milestones";
import { bootMarkets, readClock, readCollateral, readVenue, type MarketsBoot } from "../provider/boot";
import type { VenueResolution } from "../venue";
import { keys } from "./keys";
import { useReadingQuery } from "./useReadingQuery";

export { bootMarkets, type MarketsBoot };

/**
 * The three boot facts, each its own query.
 *
 * They were one read, and one read meant one gate: a five-second venue resolution held back
 * every clock- and collateral-only read behind it. Split, each fact caches, fails, retries and
 * unblocks its own dependants. None of the three declares a `needs` of its own — they are the
 * facts everything else is measured against, so gating them on each other would be circular.
 */
export function useClockFact(): Reading<ClockSync> | null {
  return useReadingQuery(keys.clock(), readClock, { pollMs: CLOCK_RESYNC_MS, needs: [] });
}

/** Decimals do not change for a chain, so this is read once and never aged out on its own. */
export function useCollateralFact(): Reading<CollateralInfo> | null {
  return useReadingQuery(keys.collateral(), readCollateral, { needs: [], staleTimeMs: Number.POSITIVE_INFINITY });
}

/** Which venue has live rows can change, so it revalidates on the market cadence. */
export function useVenueFact(env: MarketsEnv): Reading<VenueResolution> | null {
  return useReadingQuery(keys.venue(), () => readVenue(env), { pollMs: MARKETS_POLL_MS, needs: [] });
}

/**
 * All three facts as one reading, for the surfaces that genuinely want one answer — the boot
 * banner above the app, and any screen that needs decimals, venue and clock before its first
 * number. Composing here rather than in one query means a consumer of this still waits for
 * the slowest fact, but nothing else in the application does.
 */
export function useMarketsBoot(env: MarketsEnv): Reading<MarketsBoot> | null {
  const clock = useClockFact();
  const collateral = useCollateralFact();
  const venue = useVenueFact(env);
  if (!clock || !collateral || !venue) return null;
  const combined = mapReading(combineReadings(combineReadings(clock, collateral), venue), ([[c, col], v]) => ({
    clock: c,
    collateral: col,
    venue: v,
  }));
  if (isOk(combined)) mark("boot.ready");
  return combined;
}
