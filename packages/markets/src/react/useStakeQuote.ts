import type { QuoteTarget } from "@agari/core/ports";
import type { Reading } from "@agari/core/schemas";
import type { Quote, Side } from "@agari/core/types";
import { useMemo } from "react";
import { getBookParams } from "../provider/reads";
import { keys } from "./keys";
import { useBook } from "./useBook";
import { useReadingQuery } from "./useReadingQuery";

export interface StakeQuoteInput {
  target: QuoteTarget | null;
  side: Side;
  stakeBase: bigint;
  enabled?: boolean;
}

/**
 * The composing ticket's quote off the live Book. The walk itself is `book-math.ts` over the coordinated Book
 * (S2 `book_walk` mirror, wired in S4); until a Book exists the reading is the Book's own honest error, never a
 * number. Debouncing the stake input is the caller's job.
 */
export function useStakeQuote({ target, side: _side, stakeBase, enabled = true }: StakeQuoteInput): Reading<Quote | null> | null {
  const active = enabled && target !== null && stakeBase > 0n;
  const book = useBook(active ? target : null);
  const params = useReadingQuery(keys.bookParams(target?.poolAddress ?? null), () => getBookParams(target!.poolAddress), {
    enabled: active,
    staleTimeMs: Number.POSITIVE_INFINITY,
  });

  return useMemo(() => {
    if (!active) return null;
    if (book && !book.ok) return book;
    if (params && !params.ok) return params;
    return null;
  }, [active, book, params]);
}
