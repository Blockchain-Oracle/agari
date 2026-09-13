import type { BookDepth, BookLevelView, BookParams } from "@masayume/core/types";
import { priceRawToBps } from "@masayume/core/units";
import type { BinaryBookParams, BinaryOrderBook, BookLevel } from "@somnia-chain/markets-sdk";

function toLevels(levels: readonly BookLevel[], decimals: number): BookLevelView[] {
  return levels.map((level) => ({
    priceRaw: level.price,
    priceBps: priceRawToBps(level.price, decimals),
    quantityRaw: level.quantity,
  }));
}

/** The SDK book is already in each side's own terms (NO levels priced as NO); we only rename YES/NO to UP/DOWN. */
export function toBookDepth(book: BinaryOrderBook, decimals: number): BookDepth {
  return {
    upBids: toLevels(book.yesBids, decimals),
    upAsks: toLevels(book.yesAsks, decimals),
    downBids: toLevels(book.noBids, decimals),
    downAsks: toLevels(book.noAsks, decimals),
    decimals,
  };
}

export function toBookParams(params: BinaryBookParams): BookParams {
  return { tickSizeRaw: params.tickSize, lotSizeRaw: params.lotSize, minQuantityRaw: params.minQuantity };
}

export function isBookEmpty(book: BinaryOrderBook): boolean {
  return book.yesAsks.length === 0 && book.noAsks.length === 0 && book.yesBids.length === 0 && book.noBids.length === 0;
}
