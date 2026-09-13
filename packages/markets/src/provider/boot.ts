import { combineReadings, isOk, mapReading, type Reading } from "@masayume/core/schemas";
import type { ClockSync } from "@masayume/core/types";
import { loadCollateral, type CollateralInfo } from "../collateral";
import type { MarketsEnv } from "../env";
import { mark, type Milestone } from "../perf/milestones";
import { resolveVenueId, type VenueResolution } from "../venue";
import { syncClock } from "./clock-sync";

export interface MarketsBoot {
  clock: ClockSync;
  collateral: CollateralInfo;
  venue: VenueResolution;
}

/** Marks the stage the moment its own read lands, not when the slowest of the three does. */
function timed<T>(name: Milestone, read: Promise<Reading<T>>): Promise<Reading<T>> {
  return read.then((reading) => {
    if (isOk(reading)) mark(name);
    return reading;
  });
}

/** The chain clock: needed for countdowns and time-sensitive writes, not for reading a public list. */
export function readClock(): Promise<Reading<ClockSync>> {
  return timed("clock.ready", syncClock());
}

/** Collateral decimals: needed to format or move money truthfully, and never guessed at 6. */
export function readCollateral(): Promise<Reading<CollateralInfo>> {
  return timed("collateral.ready", loadCollateral());
}

/** The live venue id: needed by venue-scoped reads, which is most public market discovery. */
export function readVenue(env: MarketsEnv): Promise<Reading<VenueResolution>> {
  return timed("venue.ready", resolveVenueId(env.venueId));
}

/**
 * All three boot facts together.
 *
 * Kept because scripts, the dev port page and any caller wanting one answer still want one
 * answer. The app no longer waits on it as a single gate — each fact is its own query, so a
 * slow venue resolution can no longer hold up a read that needs only the clock.
 */
export async function bootMarkets(env: MarketsEnv): Promise<Reading<MarketsBoot>> {
  const [clock, collateral, venue] = await Promise.all([readClock(), readCollateral(), readVenue(env)]);
  const combined = mapReading(combineReadings(combineReadings(clock, collateral), venue), ([[c, col], v]) => ({
    clock: c,
    collateral: col,
    venue: v,
  }));
  if (isOk(combined)) mark("boot.ready");
  return combined;
}
