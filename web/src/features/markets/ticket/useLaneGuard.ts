"use client";

import type { BlockerContext } from "@agari/core/copy";
import { etDateOf, formatEtClock, haltLabel } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { earningsWarning, etWhen, laneAssetLabel } from "../lanes/lane-view";
import { laneState, useMarketSession, type MarketSession } from "../session";
import type { LaneGuardInput } from "./ticket-guards";

export interface LaneGuard {
  lane: LaneGuardInput | null;
  /** `opensText` for `session-closed` / `gap-listed`, `haltStale` for `halted`. */
  ctx: Pick<BlockerContext, "opensText" | "haltStale">;
  /** The earnings line under the strip; a warning, never a blocker. */
  earnings: string | null;
}

/** The pure half, so `/dev` fixtures build the exact guard a live session would. */
export function laneGuardOf(market: EventMarket, session: MarketSession | null): LaneGuard {
  const halt = session?.halt ?? null;
  const nextOpenSec = session?.status.nextOpenSec ?? null;
  const opensSec = market.lane === "gap" ? market.tradingStartSec : nextOpenSec;
  // As core `sessionLabel` says it: "09:30 ET" later today, "Mon 09:30 ET" on another day; a Gap always names its Friday.
  const sameDay = market.lane !== "gap" && opensSec !== null && session !== null && etDateOf(opensSec) === session.status.date;
  return {
    lane: session
      ? { basis: market.lane, sessionOpen: session.open, halt, laneState: laneState(session, market.asset, market.lane, market.intervalSec) }
      : null,
    ctx: {
      opensText: opensSec === null ? undefined : `${sameDay ? formatEtClock(opensSec) : etWhen(opensSec)} ET`,
      haltStale: halt ? haltLabel(halt.reason) === "Signed price stale" : undefined,
    },
    earnings: session ? earningsWarning(market, session.earnings) : null,
  };
}

/** The ticket's session-lane inputs for its Window: the halt on its asset, its lane's roller state, the hours. */
export function useLaneGuard(market: EventMarket): LaneGuard {
  const session = useMarketSession(laneAssetLabel(market.asset, market.lane));
  return laneGuardOf(market, session);
}
