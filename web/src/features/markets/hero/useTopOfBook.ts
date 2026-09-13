"use client";

import { isOk } from "@masayume/core/schemas";
import type { EventMarket } from "@masayume/core/types";
import { bpsToOddsCents } from "@masayume/core/units";
import { useBook } from "@masayume/markets/react";

export interface TopOfBook {
  /** Cents to buy $1 of UP, from the best resting ask; null when nothing rests there. */
  upCents: number | null;
  downCents: number | null;
  /** True until the first book reading lands — "…" rather than a price that is not yet known. */
  hydrating: boolean;
}

/**
 * The best ask on each side, in cents.
 *
 * Yosuku fills this row from house dry-run quotes because its venue prices off a
 * model. DreamDEX has a real order book, so the honest equivalent is the top of
 * it: what someone would actually pay right now. An empty side reads "—" — the
 * reference's own fallback — and never a filled-in number.
 */
export function useTopOfBook(market: EventMarket | null): TopOfBook {
  const book = useBook(market ? { marketId: market.marketId, poolAddress: market.poolAddress, decimals: market.decimals } : null);
  const depth = book && isOk(book) ? book.value : null;
  const up = depth?.upAsks[0];
  const down = depth?.downAsks[0];
  return {
    upCents: up ? bpsToOddsCents(up.priceBps) : null,
    downCents: down ? bpsToOddsCents(down.priceBps) : null,
    hydrating: book === null,
  };
}
