"use client";

import { MARKETS_POLL_MS } from "@masayume/core/constants";
import { isOk, type Reading } from "@masayume/core/schemas";
import type { Bytes32, Lane, LaneSet } from "@masayume/core/types";
import { laneNextStart } from "@masayume/markets";
import { keys, useLanes, useReadingQuery } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { numberCodec, usePersistedState } from "@/lib/persisted";

const LANE_KEY = "masayume.lane";
const NO_PIN = 0;

export interface LanesState {
  reading: Reading<LaneSet> | null;
  laneSet: LaneSet | null;
  /** The cadence shown: the pinned one when present, else the first live lane. */
  activeLane: Lane | null;
  activeIntervalSec: number | null;
  /** The pinned cadence has no live Window right now — it stays selected and shows "Between rounds" instead of jumping. */
  pinnedMissing: boolean;
  pin: (intervalSec: number) => void;
  /** Refetches the lane list — the one action a failed lane read should offer. */
  retry: () => void;
}

export function useLanesState(venueId: Bytes32 | null): LanesState {
  const reading = useLanes(venueId);
  const laneSet = reading && isOk(reading) ? reading.value : null;
  const [pinned, pin] = usePersistedState(LANE_KEY, NO_PIN, numberCodec);
  const queryClient = useQueryClient();
  const retry = useCallback(() => void queryClient.invalidateQueries({ queryKey: keys.lanes(venueId) }), [queryClient, venueId]);

  const lanes = laneSet?.lanes ?? [];
  const pinnedLane = pinned === NO_PIN ? null : (lanes.find((lane) => lane.intervalSec === pinned) ?? null);
  const pinnedMissing = pinned !== NO_PIN && laneSet !== null && pinnedLane === null;
  const activeLane = pinnedLane ?? (pinnedMissing ? null : (lanes[0] ?? null));

  return {
    reading,
    laneSet,
    activeLane,
    activeIntervalSec: pinnedMissing ? pinned : (activeLane?.intervalSec ?? null),
    pinnedMissing,
    pin,
    retry,
  };
}

/** Next start for an empty lane — windows are contiguous, so it is the last expiry plus the roll gap (an estimate until observed). */
export function useLaneNextStart(venueId: Bytes32 | null, intervalSec: number | null): Reading<number | null> | null {
  return useReadingQuery(
    [...keys.lanes(venueId), "next-start", intervalSec],
    () => laneNextStart(venueId as Bytes32, intervalSec as number),
    { enabled: venueId !== null && intervalSec !== null, pollMs: MARKETS_POLL_MS },
  );
}
