"use client";

import type { Reading } from "@agari/core/schemas";
import { bookStructure, type BookStructure } from "@agari/core/surface";
import type { BookDepth, BookParams, EventMarket } from "@agari/core/types";
import { useBook, useBookParams, useOpeningPrice, useSettlementFee } from "@agari/markets/react";
import { useOracleSpot } from "../markets/hero/useOracleSpot";

export interface FocalBook {
  book: Reading<BookDepth> | null;
  /** Derived once per book reading; null while hydrating or after a failed first read. */
  structure: BookStructure | null;
  params: Reading<BookParams> | null;
  fee: Reading<number> | null;
  openingRaw: bigint | null;
  /** The live price on the settlement basis, in the oracle's cents scale. */
  spotRaw: bigint | null;
}

/** Everything the book sections read for the selected Window — each a shared entry, nothing fetched twice. */
export function useFocalBook(market: EventMarket | null): FocalBook {
  const book = useBook(market ? { marketId: market.marketId, poolAddress: market.poolAddress, decimals: market.decimals } : null);
  const params = useBookParams(market?.poolAddress ?? null);
  const fee = useSettlementFee(market?.marketId ?? null);
  const opening = useOpeningPrice(market?.marketId ?? null);
  const spotRaw = useOracleSpot(market ?? null);
  return {
    book,
    structure: book && book.ok ? bookStructure(book.value) : null,
    params,
    fee,
    openingRaw: opening && opening.ok ? opening.value : (market?.openingPriceRaw ?? null),
    spotRaw,
  };
}
