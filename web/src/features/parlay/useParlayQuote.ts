"use client";

import { REQUOTE_MS } from "@masayume/core/constants";
import type { ParlayLegInput, ParlayMode, ParlayParams, ParlayQuote } from "@masayume/core/parlay";
import type { Diagnosis } from "@masayume/core/types";
import { quoteParlayOnchain } from "@masayume/markets/parlay";
import { keys, useReadingQuery } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useDebounced } from "../markets/ticket/useDebounced";

/** The reference debounces its fan-out quote 400 ms (`ParlayBuilder.tsx` L198–213). */
const PARLAY_QUOTE_DEBOUNCE_MS = 400;

export interface ParlayQuoteState {
  quote: ParlayQuote | null;
  /** Between a change and the debounced chain answer. */
  loading: boolean;
  /** The reserve's own reason it would not price this ticket. */
  error: Diagnosis | null;
  retry: () => void;
}

interface UseParlayQuoteInput {
  legs: readonly ParlayLegInput[];
  mode: ParlayMode;
  params: ParlayParams | null;
  enabled: boolean;
}

/**
 * The chain prices the ticket (`previewOpen`), exactly as the reference asked its venue for each leg's
 * dry-run quote: debounced, keyed on what is being asked, requoted on the ticket's interval.
 */
export function useParlayQuote({ legs, mode, params, enabled }: UseParlayQuoteInput): ParlayQuoteState {
  const queryClient = useQueryClient();
  const amount = mode.kind === "fixStake" ? mode.stakeBase : mode.maxPayoutBase;
  const signature = `${legs.map((leg) => `${leg.marketId}:${leg.side}`).join("|")}|${mode.kind}:${amount}`;
  const debounced = useDebounced(signature, PARLAY_QUOTE_DEBOUNCE_MS);
  const askable = enabled && params !== null && legs.length >= 2 && amount > 0n;
  const active = askable && debounced === signature;

  const reading = useReadingQuery(keys.parlayQuote(debounced), () => quoteParlayOnchain(legs, mode, params as ParlayParams), { enabled: active, pollMs: REQUOTE_MS });
  const retry = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: keys.parlayQuote(debounced) });
  }, [queryClient, debounced]);

  return {
    quote: active && reading?.ok ? reading.value : null,
    loading: askable && (!active || reading === null),
    error: active && reading && !reading.ok ? reading.error : null,
    retry,
  };
}
