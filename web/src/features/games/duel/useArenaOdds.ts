"use client";

import { isOk } from "@masayume/core/schemas";
import type { MarketId } from "@masayume/core/types";
import { useArenaQuote } from "@masayume/markets/react";
import { useMemo } from "react";
import type { DeckOdds, SideOdds } from "../stage/SwipeDeck";

/**
 * A card's per-side odds, from the venue's own book rather than a model.
 *
 * Flicky prints a probability per side from its digital-BS mark (`swipe-screen.tsx` L203–222), and
 * greys the side whose premium would fall under the venue's $1 floor. DreamDEX has a resting book, so
 * the honest figure is what `sizeForStake` reports for each side at this card's stake: the walk's
 * average price per whole contract, which is what the market charges for that side right now — a
 * `58%` UP is a side that costs 0.58 per contract. The two figures do not sum to one hundred; the
 * difference is the spread, and printing it is truer than normalising it away.
 *
 * A side is `locked` when its quote reverts on the arena's own rules — too thin to fill, too late to
 * enter, not trading. That is exactly the refusal `placePick` would give, so the deck refuses the throw
 * first. An unreadable quote (an RPC blip) is not a lock: unknown odds leave both sides open, which is
 * the reference's rule for a card with no tick yet.
 */
export function useArenaOdds(marketId: MarketId | null, stakeBase: bigint | null, decimals: number | null): DeckOdds | null {
  const up = useArenaQuote(marketId, "up", stakeBase);
  const down = useArenaQuote(marketId, "down", stakeBase);
  return useMemo(() => {
    if (marketId === null || decimals === null) return null;
    const one = 10n ** BigInt(decimals);
    const side = (reading: typeof up): SideOdds => {
      if (!reading) return { pct: null, locked: false };
      if (!isOk(reading)) return { pct: null, locked: reading.error.kind === "contract-revert" || reading.error.kind === "below-min-quantity" || reading.error.kind === "thin-book" || reading.error.kind === "market-not-trading" };
      if (!reading.value) return { pct: null, locked: false };
      return { pct: Number((reading.value.priceRaw * 100n + one / 2n) / one), locked: false };
    };
    return { up: side(up), down: side(down) };
  }, [marketId, decimals, up, down]);
}
