"use client";

import { phase as phaseOf, type MarketPhase } from "@masayume/core/lifecycle";
import type { EventMarket, MarketId, Side } from "@masayume/core/types";
import { formatBaseUnits, parseDecimalToBaseUnits } from "@masayume/core/units";
import { marketDeepLink } from "@masayume/core/urls";
import { useNextWindow, useOnchain, useOpeningPrice } from "@masayume/markets/react";
import { useCallback, useEffect, useState } from "react";
import type { TicketSelection } from "./types";

export interface TicketApi {
  market: EventMarket;
  side: Side | null;
  stakeText: string;
  stakeBase: bigint;
  /** Null until the chain clock has ticked once. */
  phase: MarketPhase | null;
  /** The window the Ticket auto-advanced away from, until the user edits the stake. */
  advancedFrom: EventMarket | null;
  nowMs: number;
  setStakeText: (text: string) => void;
  setStakeBase: (base: bigint) => void;
  selectSide: (side: Side) => void;
}

/** Market and side live in the URL (a share link reproduces them); the App Router re-derives from replaceState. */
function replaceSelection(marketId: MarketId, side: Side | null): void {
  window.history.replaceState(null, "", marketDeepLink({ marketId, dir: side ?? undefined }));
}

/** The stake starts EMPTY on the hero entry; context-carrying entries (Reels, Baku) pre-fill it in later stories. */
export function useTicket({ market, side, nowMs }: TicketSelection): TicketApi {
  const [stakeText, setStakeText] = useState("");
  const [advancedFrom, setAdvancedFrom] = useState<EventMarket | null>(null);
  const opening = useOpeningPrice(market.marketId);
  const onchain = useOnchain(market.marketId);

  const phase =
    nowMs > 0
      ? phaseOf(
          {
            ...market,
            openingPriceRaw: opening?.ok ? opening.value : market.openingPriceRaw,
            onchainStatus: onchain?.ok ? onchain.value.status : null,
          },
          nowMs,
        )
      : null;

  const successor = useNextWindow(phase === "noEntryBuffer" ? market : null);

  // Inside the no-entry buffer the Ticket moves to the next window and keeps side + stake (FR-9).
  useEffect(() => {
    if (phase !== "noEntryBuffer" || !successor?.ok || !successor.value) return;
    if (successor.value.marketId === market.marketId) return;
    setAdvancedFrom(market);
    replaceSelection(successor.value.marketId, side);
  }, [phase, successor, market, side]);

  useEffect(() => setAdvancedFrom(null), [stakeText]);

  const stakeBase = parseDecimalToBaseUnits(stakeText, market.decimals) ?? 0n;
  const setStakeBase = useCallback(
    (base: bigint) => setStakeText(formatBaseUnits(base, market.decimals, { group: false, minDp: 0 })),
    [market.decimals],
  );
  const selectSide = useCallback((next: Side) => replaceSelection(market.marketId, next), [market.marketId]);

  return { market, side, stakeText, stakeBase, phase, advancedFrom, nowMs, setStakeText, setStakeBase, selectSide };
}
