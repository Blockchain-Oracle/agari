"use client";

import { isOk } from "@masayume/core/schemas";
import type { Bytes32 } from "@masayume/core/types";
import { secToMs } from "@masayume/core/units";
import { EmptyState, LoadingState } from "@/components/states";
import { betweenRoundsLine, MARKETS } from "@/lib/copy";
import { useLaneNextStart } from "./useLanes";

interface BetweenRoundsProps {
  venueId: Bytes32 | null;
  intervalSec: number;
  nowMs: number;
}

/** An empty lane says when the next Window opens — an estimate from the last expiry, never a hardcoded schedule. */
export function BetweenRounds({ venueId, intervalSec, nowMs }: BetweenRoundsProps) {
  const next = useLaneNextStart(venueId, intervalSec);
  if (next === null || nowMs === 0) return <LoadingState shape="line" />;
  const nextStartMs = isOk(next) && next.value !== null ? secToMs(next.value) : null;
  const line = betweenRoundsLine(nextStartMs, nowMs, intervalSec);
  return <EmptyState why={nextStartMs === null ? line : `${line} (${MARKETS.estimated})`} />;
}
