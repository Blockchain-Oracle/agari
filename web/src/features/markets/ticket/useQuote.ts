"use client";

import { QUOTE_DEBOUNCE_MS, QUOTE_STALE_AFTER_MS } from "@masayume/core/constants";
import type { Reading } from "@masayume/core/schemas";
import type { EventMarket, Quote, Side } from "@masayume/core/types";
import { useStakeQuote } from "@masayume/markets/react";
import { useDebounced } from "./useDebounced";

export interface QuoteState {
  reading: Reading<Quote | null> | null;
  quote: Quote | null;
  /** The book moved on, or the quote is older than the requote window: visibly stale, never silently reused. */
  stale: boolean;
  /** Between a keystroke and the debounced live quote. */
  pending: boolean;
  partial: boolean;
}

interface UseQuoteInput {
  market: EventMarket;
  side: Side | null;
  stakeBase: bigint;
  nowMs: number;
  enabled: boolean;
}

/** Debounces the stake ~350 ms, then rides the live book with a ~12 s requote (FR-8). */
export function useQuote({ market, side, stakeBase, nowMs, enabled }: UseQuoteInput): QuoteState {
  const debounced = useDebounced(stakeBase, QUOTE_DEBOUNCE_MS);
  const active = enabled && side !== null && debounced > 0n;
  const reading = useStakeQuote({
    target: { marketId: market.marketId, poolAddress: market.poolAddress, decimals: market.decimals, intervalSec: market.intervalSec },
    side: side ?? "up",
    stakeBase: debounced,
    enabled: active,
  });
  const quote = reading?.ok ? reading.value : null;
  const aged = quote !== null && nowMs > 0 && nowMs - quote.quotedAtMs > QUOTE_STALE_AFTER_MS;
  return {
    reading: active ? reading : null,
    quote,
    stale: Boolean(reading?.ok && (reading.stale || aged)),
    pending: enabled && (stakeBase !== debounced || (active && reading === null)),
    partial: quote?.partial ?? false,
  };
}
