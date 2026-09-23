"use client";

import type { BlockerContext } from "@agari/core/copy";
import { haltLabel } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { earningsWarning, laneAssetLabel } from "../lanes/lane-view";
import { laneState, useMarketSession, type MarketSession } from "../session";
import type { LaneGuardInput } from "./ticket-guards";
import { useWhen } from "@/lib/when";

export interface LaneGuard {
  lane: LaneGuardInput | null;
  /** `opensText` for `session-closed` / `gap-listed`, `haltStale` for `halted`. */
  ctx: Pick<BlockerContext, "opensText" | "haltStale">;
  /** The earnings line under the strip; a warning, never a blocker. */
  earnings: string | null;
}

/** The pure half, so `/dev` fixtures build the exact guard a live session would. */
export function laneGuardOf(market: EventMarket, session: MarketSession | null): LaneGuard {
  const when = useWhen();
  const halt = session?.halt ?? null;
  const nextOpenSec = session?.status.nextOpenSec ?? null;
  const opensSec = market.lane === "gap" ? market.tradingStartSec : nextOpenSec;
  // The weekday rule is `whenFor`'s (S23): dropped only within twelve hours on the same date; a Gap names its Friday.
  return {
    lane: session
      ? { basis: market.lane, sessionOpen: session.open, halt, laneState: laneState(session, market.asset, market.lane, market.intervalSec) }
      : null,
    ctx: {
      opensText: opensSec === null ? undefined : when(opensSec),
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
