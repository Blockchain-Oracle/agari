"use client";

import { REQUOTE_MS } from "@masayume/core/constants";
import type { PrivateQuote } from "@masayume/core/private";
import type { Diagnosis, EventMarket, Side } from "@masayume/core/types";
import { sizePrivateForStake } from "@masayume/markets/private";
import { keys, useReadingQuery } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useDebounced } from "../markets/ticket/useDebounced";

const QUOTE_DEBOUNCE_MS = 400;

export interface PrivateQuoteState {
  quote: PrivateQuote | null;
  loading: boolean;
  /** The desk's own reason it would not size this stake. */
  error: Diagnosis | null;
  retry: () => void;
}

interface UsePrivateQuoteInput {
  market: EventMarket;
  side: Side | null;
  stakeBase: bigint;
  enabled: boolean;
}

/** The desk contract sizes and prices the stake (`sizeForStake`), debounced and requoted on the ticket's interval. */
export function usePrivateQuote({ market, side, stakeBase, enabled }: UsePrivateQuoteInput): PrivateQuoteState {
  const queryClient = useQueryClient();
  const signature = side ? `${market.marketId}:${side}:${stakeBase}` : "";
  const debounced = useDebounced(signature, QUOTE_DEBOUNCE_MS);
  const askable = enabled && side !== null && stakeBase > 0n;
  const active = askable && debounced === signature;

  const reading = useReadingQuery(keys.privateQuote(debounced), () => sizePrivateForStake(market.marketId, side as Side, stakeBase), { enabled: active, pollMs: REQUOTE_MS });
  const retry = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: keys.privateQuote(debounced) });
  }, [queryClient, debounced]);

  return {
    quote: active && reading?.ok ? reading.value : null,
    loading: askable && (!active || reading === null),
    error: active && reading && !reading.ok ? reading.error : null,
    retry,
  };
}
