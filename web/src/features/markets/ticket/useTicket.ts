"use client";

import { phase as phaseOf, type MarketPhase } from "@agari/core/lifecycle";
import type { EventMarket, MarketId, Side } from "@agari/core/types";
import { formatBaseUnits, parseDecimalToBaseUnits } from "@agari/core/units";
import { marketDeepLink } from "@agari/core/urls";
import { useNextWindow, useOnchain, useOpeningPrice } from "@agari/markets/react";
import { useCallback, useEffect, useState } from "react";
import { takeStakePreset } from "./stake-preset";
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

/**
 * The Window's phase as the ticket reads it: the indexed row, the head-fresh opening print and on-chain status, on the
 * chain-corrected clock (AD-1). Null before the first client tick. The dock reads it to pick the composer (a listed
 * Window takes a scheduled call, D-088); the ticket reads it for everything else.
 */
export function useWindowPhase(market: EventMarket | null, nowMs: number): MarketPhase | null {
  const opening = useOpeningPrice(market?.marketId ?? null);
  const onchain = useOnchain(market?.marketId ?? null);
  return market && nowMs > 0
    ? phaseOf(
        {
          ...market,
          openingPriceRaw: opening?.ok ? opening.value : market.openingPriceRaw,
          onchainStatus: onchain?.ok ? onchain.value.status : null,
        },
        nowMs,
      )
    : null;
}

/** The stake starts EMPTY on the hero entry; a context-carrying entry (the hedge card) pre-fills it once via `presetStake`. */
export function useTicket({ market, side, nowMs, sessionId }: TicketSelection): TicketApi {
  const [stakeText, setStakeText] = useState("");
  const [advancedFrom, setAdvancedFrom] = useState<EventMarket | null>(null);
  const phase = useWindowPhase(market, nowMs);

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

  // Every tap that opens the ticket bumps `sessionId`; a preset left for this Window is taken on that tap only.
  useEffect(() => {
    const preset = takeStakePreset(market.marketId);
    if (preset !== null) setStakeBase(preset);
  }, [market.marketId, sessionId, setStakeBase]);

  return { market, side, stakeText, stakeBase, phase, advancedFrom, nowMs, setStakeText, setStakeBase, selectSide };
}
