"use client";

import type { EventMarket, Lane, LaneSet, MarketId, Side } from "@masayume/core/types";
import { marketDeepLink } from "@masayume/core/urls";
import { useCallback, useState } from "react";
import { findMarket, useResolveDeepLink } from "@/lib/deep-link";

/** The reference's `lg:` — from here up the ticket is docked in the hero; below it, a drawer slides over the page. */
export const TICKET_RAIL_MIN_WIDTH = 1024;

/** What the hero and the Ticket render from — the URL is the source of truth, so a share link reproduces it exactly. */
export interface MarketsSelection {
  marketId: MarketId | null;
  side: Side | null;
  market: EventMarket | null;
  /** Chain-corrected clock, ticking; 0 before the first client tick. */
  nowMs: number;
  /** True while a deep link is still being resolved against the chain. */
  resolving: boolean;
  /**
   * Bumped on every tap that opens the ticket — the reference's `sessionId: Date.now()`
   * (`app/markets/page.tsx:584`). The URL alone cannot carry "open it again": a card-body tap with
   * no side, or a second tap on the side already chosen, changes nothing in the address bar, and
   * without this a phone tapped a card and saw nothing happen.
   */
  sessionId: number;
}

export interface MarketsSelectionApi {
  selection: MarketsSelection;
  setSelection: (marketId: MarketId, side?: Side) => void;
}

/** Deep link → pinned lane's soonest Window → first live Window. */
export function useMarketsSelection(lanes: LaneSet | null, activeLane: Lane | null, nowMs: number): MarketsSelectionApi {
  const resolved = useResolveDeepLink(lanes, nowMs);
  const [sessionId, setSessionId] = useState(0);
  const fallback = activeLane?.markets[0] ?? lanes?.lanes[0]?.markets[0] ?? null;
  const market = resolved.market ?? findMarket(lanes, resolved.marketId) ?? fallback;

  /**
   * The reference's `openTicket` (`app/markets/page.tsx:583-589`), whole. On desktop the bet lives in
   * the hero at the top of the page, so the page is brought there — this was the one line missing
   * from the port, and its absence was "I tap UP on a card and have to scroll up to find the ticket".
   */
  const setSelection = useCallback(
    (marketId: MarketId, side?: Side) => {
      const dir = side ?? resolved.side ?? undefined;
      window.history.replaceState(null, "", marketDeepLink({ marketId, dir }));
      setSessionId(Date.now());
      if (window.innerWidth >= TICKET_RAIL_MIN_WIDTH) window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [resolved.side],
  );

  return {
    selection: { marketId: market?.marketId ?? null, side: resolved.side, market, nowMs, resolving: resolved.resolving, sessionId },
    setSelection,
  };
}
