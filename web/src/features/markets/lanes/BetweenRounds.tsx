"use client";

import { isOk } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { secToMs } from "@agari/core/units";
import { EmptyState, LoadingState } from "@/components/states";
import { betweenRoundsLine, MARKETS } from "@/lib/copy";
import { useLaneNextStart } from "./useLanes";

interface BetweenRoundsProps {
  venueId: Address | null;
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
