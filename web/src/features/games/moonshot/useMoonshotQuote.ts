"use client";

import { REQUOTE_MS } from "@masayume/core/constants";
import type { MoonshotCall, RangeMode, RangeParams } from "@masayume/core/range";
import type { Diagnosis } from "@masayume/core/types";
import { marketsProvider } from "@masayume/markets";
import { quoteMoonshotOnchain, type MoonshotQuote, type MoonshotWindow } from "@masayume/markets/range";
import { keys, useReadingQuery } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { useDebounced } from "../../markets/ticket/useDebounced";

/** The same 400 ms the range ticket settles for: a run up the ladder is one chain read, not ten. */
const MOONSHOT_QUOTE_DEBOUNCE_MS = 400;

export interface MoonshotQuoteState {
  quote: MoonshotQuote | null;
  loading: boolean;
  /** The reserve's own reason it would not price this call. */
  error: Diagnosis | null;
  retry: () => void;
}

interface UseMoonshotQuoteInput {
  /** The Window the call sits on, as the reserve names it. */
  market: MoonshotWindow | null;
  expirySec: number | null;
  call: MoonshotCall;
  mode: RangeMode;
  params: RangeParams | null;
  enabled: boolean;
}

/**
 * The chain solves and prices the call (`previewBasis` → `solveStrike` → `previewOpen`), debounced and requoted on
 * the ticket's interval. The seconds left are read at quote time rather than keyed, so the ticking clock does
 * not re-ask the chain every second; the key shares the range quote's family so one invalidation clears both.
 */
export function useMoonshotQuote({ market, expirySec, call, mode, params, enabled }: UseMoonshotQuoteInput): MoonshotQuoteState {
  const queryClient = useQueryClient();
  const amount = mode.kind === "fixStake" ? mode.stakeBase : mode.maxPayoutBase;
  const signature = market ? `moonshot:${market.marketId}:${market.asset}:${call.direction}:${call.multiple}|${mode.kind}:${amount}` : "";
  const debounced = useDebounced(signature, MOONSHOT_QUOTE_DEBOUNCE_MS);
  const askable = enabled && params !== null && market !== null && expirySec !== null && amount > 0n;
  const active = askable && debounced === signature;

  const reading = useReadingQuery(
    keys.rangeQuote(debounced),
    () => {
      const tauSec = Math.max(1, (expirySec as number) - Math.floor(marketsProvider.nowMs() / 1000));
      return quoteMoonshotOnchain(market as MoonshotWindow, call, mode, params as RangeParams, tauSec);
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
