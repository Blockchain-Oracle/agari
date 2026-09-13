"use client";

import { isEnterable, phase } from "@masayume/core/lifecycle";
import type { EventMarket, Lane, LaneSet } from "@masayume/core/types";
import { useEffect, useMemo, useState } from "react";

export interface ComposerHorizon {
  lanes: readonly Lane[];
  intervalSec: number | null;
  setIntervalSec: (intervalSec: number) => void;
  /** The soonest live, still-enterable Window of the chosen cadence — the one the call is on. */
  market: EventMarket | null;
  /** Whether a cadence has any Window a call could be made on right now. */
  hasLive: (intervalSec: number) => boolean;
}

function soonestEnterable(lane: Lane | undefined, nowMs: number): EventMarket | null {
  if (!lane || nowMs === 0) return null;
  return [...lane.markets].filter((market) => isEnterable(phase(market, nowMs))).sort((a, b) => a.expirySec - b.expirySec)[0] ?? null;
}

/**
 * Which Window a take is about.
 *
 * The reference offers three fixed cadences and defaults to 5m
 * (`TakeComposer624.tsx` L25–26, L36); lanes here are whatever the venue lists, so
 * the horizon row is the live lane set and the default is the first cadence with a
 * Window still taking entries. The market itself is the soonest such Window — the
 * same rule the reference uses (L52–57), with `phase()` as the cutoff rather than a
 * bare `expiry > now`, so a call cannot be posted on a Window nobody can enter.
 */
export function useComposerMarket(laneSet: LaneSet | null, nowMs: number): ComposerHorizon {
  const lanes = useMemo(() => laneSet?.lanes ?? [], [laneSet]);
  const [intervalSec, setIntervalSec] = useState<number | null>(null);

  const hasLive = (sec: number) => soonestEnterable(lanes.find((lane) => lane.intervalSec === sec), nowMs) !== null;

  useEffect(() => {
    if (intervalSec !== null || nowMs === 0) return;
    const first = lanes.find((lane) => soonestEnterable(lane, nowMs) !== null);
    if (first) setIntervalSec(first.intervalSec);
  }, [lanes, nowMs, intervalSec]);

  const market = useMemo(() => soonestEnterable(lanes.find((lane) => lane.intervalSec === intervalSec), nowMs), [lanes, intervalSec, nowMs]);

  return { lanes, intervalSec, setIntervalSec, market, hasLive };
}
