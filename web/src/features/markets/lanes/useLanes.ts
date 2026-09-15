"use client";

import { MARKETS_POLL_MS } from "@agari/core/constants";
import { isOk, type Reading } from "@agari/core/schemas";
import type { TickerSymbol } from "@agari/core/market";
import type { Address, Lane, LaneSet } from "@agari/core/types";
import { laneNextStart } from "@agari/markets";
import { keys, useLanes, useReadingQuery } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { usePersistedState } from "@/lib/persisted";
import { laneTabKey, laneTabParts, parseLaneTabKey, type LaneTabKey } from "./lane-view";
import { useTickerPin } from "./useTickerPin";

const LANE_KEY = "agari.lane";
const NO_PIN = "";

/** `regular:300`, `gap:604800`, `token:300`; a pre-S6 bare cadence reads as its Regular lane. */
const laneKeyCodec = {
  parse: (raw: string): LaneTabKey | typeof NO_PIN | null => (raw === NO_PIN ? NO_PIN : parseLaneTabKey(raw)),
  serialize: (value: LaneTabKey | typeof NO_PIN) => value,
};

export interface LanesState {
  reading: Reading<LaneSet> | null;
  laneSet: LaneSet | null;
  /** The cadence shown: the pinned one when present, else the first live lane. */
  activeLane: Lane | null;
  /** The shown lane's `basis:cadence` key (the pinned one while it has no live Window). */
  activeKey: LaneTabKey | null;
  activeIntervalSec: number | null;
  /** The pinned lane has no live Window right now — it stays selected and shows "Between rounds" instead of jumping. */
  pinnedMissing: boolean;
  pin: (key: LaneTabKey) => void;
  /** The pinned ticker (`agari.ticker`); null lists every ticker. */
  ticker: TickerSymbol | null;
  pinTicker: (ticker: TickerSymbol | null) => void;
  /** Refetches the lane list — the one action a failed lane read should offer. */
  retry: () => void;
}

export function useLanesState(venueId: Address | null): LanesState {
  const reading = useLanes(venueId);
  const laneSet = reading && isOk(reading) ? reading.value : null;
  const [pinned, pin] = usePersistedState<LaneTabKey | typeof NO_PIN>(LANE_KEY, NO_PIN, laneKeyCodec);
  const [ticker, pinTicker] = useTickerPin();
  const queryClient = useQueryClient();
  const retry = useCallback(() => void queryClient.invalidateQueries({ queryKey: keys.lanes(venueId) }), [queryClient, venueId]);

  const lanes = laneSet?.lanes ?? [];
  const pinnedKey = pinned === NO_PIN ? null : pinned;
  const pinnedLane = pinnedKey === null ? null : (lanes.find((lane) => laneTabKey(lane.basis, lane.intervalSec) === pinnedKey) ?? null);
  const pinnedMissing = pinnedKey !== null && laneSet !== null && pinnedLane === null;
  const activeLane = pinnedLane ?? (pinnedMissing ? null : (lanes[0] ?? null));
  const activeKey = pinnedMissing ? pinnedKey : activeLane ? laneTabKey(activeLane.basis, activeLane.intervalSec) : null;

  return {
    reading,
    laneSet,
    activeLane,
    activeKey,
    activeIntervalSec: activeKey ? laneTabParts(activeKey).intervalSec : null,
    pinnedMissing,
    pin,
    ticker,
    pinTicker,
    retry,
  };
}

/** Next start for an empty lane — windows are contiguous, so it is the last expiry plus the roll gap (an estimate until observed). */
export function useLaneNextStart(venueId: Address | null, intervalSec: number | null): Reading<number | null> | null {
  return useReadingQuery(
    [...keys.lanes(venueId), "next-start", intervalSec],
    () => laneNextStart(venueId as Address, intervalSec as number),
    { enabled: venueId !== null && intervalSec !== null, pollMs: MARKETS_POLL_MS },
  );
}
