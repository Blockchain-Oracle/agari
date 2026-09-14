import { REQUOTE_MS } from "@agari/core/constants";
import type { QuoteTarget } from "@agari/core/ports";
import { isOk, ok, stale, type Reading } from "@agari/core/schemas";
import type { Quote, Side } from "@agari/core/types";
import { useCallback, useMemo, useSyncExternalStore } from "react";
import { nowMs, nowSec } from "../provider/clock";
import { getBookParams } from "../provider/reads";
import { bookSnapshot, bookStateSnapshot, subscribeBook } from "../runtime/coordinator";
import { quoteFromBook } from "../runtime/mappers";
import { keys } from "./keys";
import { useReadingQuery } from "./useReadingQuery";
import { useTick } from "./useTick";

export interface StakeQuoteInput {
  target: QuoteTarget | null;
  side: Side;
  stakeBase: bigint;
  enabled?: boolean;
}

/**
 * The composing ticket's quote off the coordinated Book (the same entry every card and the hero share), recomputed
 * on every Book change and every `REQUOTE_MS`. The walk is `quoteFromBook`, the kernel the submitter re-quotes with
 * at click time. Debouncing the stake input is the caller's job.
 */
export function useStakeQuote({ target, side, stakeBase, enabled = true }: StakeQuoteInput): Reading<Quote | null> | null {
  const active = enabled && target !== null && stakeBase > 0n;
  const marketId = active ? target.marketId : null;
  const poolAddress = active ? target.poolAddress : null;
  const decimals = target?.decimals ?? 0;
  const intervalSec = target?.intervalSec ?? 0;

  const subscribe = useCallback(
    (onChange: () => void) => (marketId === null || poolAddress === null ? () => undefined : subscribeBook({ marketId, poolAddress, decimals }, onChange)),
    [marketId, poolAddress, decimals],
  );
  const view = useSyncExternalStore(subscribe, () => bookStateSnapshot(marketId), () => null);
  const depth = useSyncExternalStore(subscribe, () => bookSnapshot(marketId), () => null);
  // Shares `useBookParams`' entry: a Book that isn't there is the honest error rather than a quote of nothing.
  const params = useReadingQuery(keys.bookParams(poolAddress), () => getBookParams(poolAddress!), {
    enabled: active,
    staleTimeMs: Number.POSITIVE_INFINITY,
  });
  const tick = useTick(REQUOTE_MS);

  return useMemo(() => {
    if (!active || marketId === null || poolAddress === null) return null;
    if (params && !isOk(params)) return params;
    if (!view) return depth && !isOk(depth) ? depth : null;
    const quote = quoteFromBook(view.book, view.series, { marketId, poolAddress, decimals, intervalSec }, side, stakeBase, nowSec());
    const reading = ok(quote && { ...quote, quotedAtMs: nowMs() }, nowMs());
    return view.live ? reading : stale(reading, "offline");
    // `tick` forces a requote on the interval even when the Book is unchanged (expiry, the clock).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, marketId, poolAddress, decimals, intervalSec, view, depth, params, side, stakeBase, tick]);
}
