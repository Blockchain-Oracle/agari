"use client";

import { REQUOTE_MS } from "@masayume/core/constants";
import type { RangeMode, RangeParams, RangeQuote } from "@masayume/core/range";
import type { Diagnosis } from "@masayume/core/types";
import { marketsProvider } from "@masayume/markets";
import { quoteRangeOnchain, type RangeBand } from "@masayume/markets/range";
import { keys, useReadingQuery } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useDebounced } from "../markets/ticket/useDebounced";

/** The reference debounces its quote 400 ms; a band drag settles before the chain is asked. */
const RANGE_QUOTE_DEBOUNCE_MS = 400;

export interface RangeQuoteState {
  quote: RangeQuote | null;
  loading: boolean;
  /** The reserve's own reason it would not price this band. */
  error: Diagnosis | null;
  retry: () => void;
}

interface UseRangeQuoteInput {
  band: RangeBand | null;
  expirySec: number | null;
  mode: RangeMode;
  params: RangeParams | null;
  enabled: boolean;
}

/**
 * The chain prices the band (`previewOpen`), debounced and requoted on the ticket's interval. The seconds
 * left are read at quote time rather than keyed, so a ticking clock does not re-ask the chain every second.
 */
export function useRangeQuote({ band, expirySec, mode, params, enabled }: UseRangeQuoteInput): RangeQuoteState {
  const queryClient = useQueryClient();
  const amount = mode.kind === "fixStake" ? mode.stakeBase : mode.maxPayoutBase;
  const signature = band ? `${band.marketId}:${band.asset}:${band.side}:${band.lowPrint}:${band.highPrint}|${mode.kind}:${amount}` : "";
  const debounced = useDebounced(signature, RANGE_QUOTE_DEBOUNCE_MS);
  const askable = enabled && params !== null && band !== null && expirySec !== null && amount > 0n;
  const active = askable && debounced === signature;

  const reading = useReadingQuery(
    keys.rangeQuote(debounced),
    () => {
      const tauSec = Math.max(1, (expirySec as number) - Math.floor(marketsProvider.nowMs() / 1000));
      return quoteRangeOnchain(band as RangeBand, mode, params as RangeParams, tauSec);
    },
    { enabled: active, pollMs: REQUOTE_MS },
  );
  const retry = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: keys.rangeQuote(debounced) });
  }, [queryClient, debounced]);

  return {
    quote: active && reading?.ok ? reading.value : null,
    loading: askable && (!active || reading === null),
    error: active && reading && !reading.ok ? reading.error : null,
    retry,
  };
}
