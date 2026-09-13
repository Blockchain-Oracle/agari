"use client";

import { isOk, type Reading } from "@masayume/core/schemas";
import type { Bytes32 } from "@masayume/core/types";
import { useClockFact, useCollateralFact, useMarketsBoot, useVenueFact, type MarketsBoot } from "@masayume/markets/react";
import { webEnv } from "@/lib/env";

export interface VenueContext {
  /** All three facts together — for the boot banner and anything that truly needs the set. */
  boot: Reading<MarketsBoot> | null;
  /** Null until the venue read answers or when no venue has live rows. */
  venueId: Bytes32 | null;
  /** Collateral decimals read from chain; null until known — never a guessed 6. */
  decimals: number | null;
  clockOffsetMs: number;
}

/**
 * The boot facts a markets surface needs, each taken from its own query.
 *
 * Reading them separately is the whole point: the venue id arrives when the venue read
 * lands, not when the slowest of three unrelated reads does, so the lane list can start
 * while collateral is still in flight. All four hooks share the same cache entries, so this
 * costs no extra chain reads.
 */
export function useVenue(): VenueContext {
  const boot = useMarketsBoot(webEnv.markets);
  const venue = useVenueFact(webEnv.markets);
  const collateral = useCollateralFact();
  const clock = useClockFact();
  return {
    boot,
    venueId: venue && isOk(venue) ? venue.value.venueId : null,
    decimals: collateral && isOk(collateral) ? collateral.value.decimals : null,
    clockOffsetMs: clock && isOk(clock) ? clock.value.offsetMs : 0,
  };
}
