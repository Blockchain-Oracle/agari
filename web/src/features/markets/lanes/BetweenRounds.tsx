"use client";

import { isOk } from "@agari/core/schemas";
import type { Address, LaneBasis } from "@agari/core/types";
import { secToMs } from "@agari/core/units";
import { EmptyState, LoadingState } from "@/components/states";
import { betweenRoundsLine, MARKETS } from "@/lib/copy";
import type { MarketSession } from "../session";
import { useLaneNextStart } from "./useLanes";

interface BetweenRoundsProps {
  venueId: Address | null;
  basis: LaneBasis;
  intervalSec: number;
  nowMs: number;
  /** Outside regular hours a Regular lane's next Window waits on the session; the Gap and token lanes don't. */
  session: MarketSession | null;
}

/** An empty lane says when the next Window opens — an estimate from the last expiry, never a hardcoded schedule. */
export function BetweenRounds({ venueId, basis, intervalSec, nowMs, session }: BetweenRoundsProps) {
  const closed = basis === "regular" && session !== null && !session.open;
  const next = useLaneNextStart(closed ? null : venueId, intervalSec);
  if (closed) return <EmptyState why={MARKETS.closedWindows(session.label).why} />;
  if (next === null || nowMs === 0) return <LoadingState shape="line" />;
  // Off-hours the lane's last expiry is the previous close, already behind the clock: not a next start to count down to.
  const nextStartMs = isOk(next) && next.value !== null && secToMs(next.value) > nowMs ? secToMs(next.value) : null;
  const line = betweenRoundsLine(nextStartMs, nowMs, intervalSec);
  return <EmptyState why={nextStartMs === null ? line : `${line} (${MARKETS.estimated})`} />;
}
