"use client";

import { REQUOTE_MS } from "@masayume/core/constants";
import type { LeverageParams, LeverageQuote } from "@masayume/core/leverage";
import type { Diagnosis, EventMarket, Side } from "@masayume/core/types";
import { sizeLeverageForStake } from "@masayume/markets/leverage";
import { keys, useReadingQuery } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useDebounced } from "../markets/ticket/useDebounced";

/** The reference debounces its quote 400 ms; a stake being typed settles before the chain is asked. */
const QUOTE_DEBOUNCE_MS = 400;

export interface LeverageQuoteState {
  quote: LeverageQuote | null;
  loading: boolean;
  /** The reserve's own reason it would not price this boost. */
  error: Diagnosis | null;
  retry: () => void;
}

interface UseLeverageQuoteInput {
  market: EventMarket;
  side: Side | null;
  stakeBase: bigint;
  leverageBps: number;
  params: LeverageParams | null;
  enabled: boolean;
}

/** The chain sizes and prices the boost (`sizeForStake`), debounced and requoted on the ticket's interval. */
export function useLeverageQuote({ market, side, stakeBase, leverageBps, params, enabled }: UseLeverageQuoteInput): LeverageQuoteState {
  const queryClient = useQueryClient();
  const signature = side ? `${market.marketId}:${side}:${leverageBps}:${stakeBase}` : "";
  const debounced = useDebounced(signature, QUOTE_DEBOUNCE_MS);
  const askable = enabled && params !== null && side !== null && stakeBase > 0n;
  const active = askable && debounced === signature;

  const reading = useReadingQuery(
    keys.leverageQuote(debounced),
    () => sizeLeverageForStake(market.marketId, side as Side, stakeBase, leverageBps, (params as LeverageParams).maintenanceBps),
    { enabled: active, pollMs: REQUOTE_MS },
  );
  const retry = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: keys.leverageQuote(debounced) });
  }, [queryClient, debounced]);

  return {
    quote: active && reading?.ok ? reading.value : null,
    loading: askable && (!active || reading === null),
    error: active && reading && !reading.ok ? reading.error : null,
    retry,
  };
}
