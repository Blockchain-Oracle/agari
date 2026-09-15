"use client";

import { sessionPhrase } from "@agari/core/copy";
import { isOk } from "@agari/core/schemas";
import type { Address, LaneBasis } from "@agari/core/types";
import { secToMs } from "@agari/core/units";
import { marketsProvider } from "@agari/markets";
import { EmptyState, LoadingState } from "@/components/states";
import { betweenRoundsLine, MARKETS } from "@/lib/copy";
import { SESSION_COPY } from "@/lib/copy-session";
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
  if (closed) {
    // The session phrase carries the countdown (D-087); the next action never dead-ends the lane.
    const nowSec = Math.floor((nowMs > 0 ? nowMs : marketsProvider.nowMs()) / 1000);
    return <EmptyState why={SESSION_COPY.lanes.closed(sessionPhrase(session.status, nowSec))} nextAction={{ label: SESSION_COPY.ticket.readWire, href: "/news" }} />;
  }
  if (next === null || nowMs === 0) return <LoadingState shape="line" />;
  // Off-hours the lane's last expiry is the previous close, already behind the clock: not a next start to count down to.
  const nextStartMs = isOk(next) && next.value !== null && secToMs(next.value) > nowMs ? secToMs(next.value) : null;
  const line = betweenRoundsLine(nextStartMs, nowMs, intervalSec);
  return <EmptyState why={nextStartMs === null ? line : `${line} (${MARKETS.estimated})`} />;
}
