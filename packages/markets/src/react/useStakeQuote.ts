import { REQUOTE_MS } from "@masayume/core/constants";
import type { QuoteTarget } from "@masayume/core/ports";
import { isOk, ok, stale, type Reading } from "@masayume/core/schemas";
import type { Quote, Side } from "@masayume/core/types";
import { useLiveBinaryOrderBookByMarket, useLiveStatus, useWatchMarket } from "@somnia-chain/markets-sdk/react";
import { useMemo } from "react";
import { getBookParams } from "../provider/books";
import { nowMs } from "../provider/clock";
import { settlementFeeBps } from "../provider/fees";
import { quoteFromBook } from "../provider/quotes";
import { keys } from "./keys";
import { useReadingQuery } from "./useReadingQuery";
import { useTick } from "./useTick";

export interface StakeQuoteInput {
  target: QuoteTarget | null;
  side: Side;
  stakeBase: bigint;
  enabled?: boolean;
}

/** Composing-Ticket quote off the live book, recomputed every REQUOTE_MS. Debouncing the stake input is the caller's job. */
export function useStakeQuote({ target, side, stakeBase, enabled = true }: StakeQuoteInput): Reading<Quote | null> | null {
  const active = enabled && target !== null && stakeBase > 0n;
  const watch = useWatchMarket(active ? target?.poolAddress : undefined);
  const book = useLiveBinaryOrderBookByMarket(active ? target?.marketId : undefined);
  const status = useLiveStatus();
  const params = useReadingQuery(keys.bookParams(target?.poolAddress ?? null), () => getBookParams(target!.poolAddress), {
    enabled: active,
    staleTimeMs: Number.POSITIVE_INFINITY,
  });
  const fee = useReadingQuery(keys.fee(target?.marketId ?? null), () => settlementFeeBps(target!.marketId), { enabled: active });
  const tick = useTick(REQUOTE_MS);

  return useMemo(() => {
    if (!active || !target || watch === "hydrating" || !params || !fee) return null;
    if (!isOk(params)) return params;
    if (!isOk(fee)) return fee;
    const reading = ok(quoteFromBook({ book, params: params.value, target, side, stakeBase, feeBps: fee.value }), nowMs());
    if (watch !== "live" || !status.wsConnected) return stale(reading, "offline");
    const innerStale = params.staleReason ?? fee.staleReason;
    return innerStale ? stale(reading, innerStale) : reading;
    // `tick` is a deliberate dependency: it forces a requote on the interval even when the book is unchanged.
  }, [active, target, watch, book, params, fee, side, stakeBase, status.wsConnected, tick]);
}
