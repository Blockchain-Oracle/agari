import type { BookTarget } from "@masayume/core/ports";
import type { Reading } from "@masayume/core/schemas";
import type { Address, BookDepth, BookParams, MarketId } from "@masayume/core/types";
import { getClient } from "../runtime/read-runtime";
import { toBookDepth, toBookParams } from "../mappers/book";
import { withReading } from "./reading";

export const DEFAULT_BOOK_DEPTH = 10;

/** Head-fresh chain book. The pool is recycled, so the caller keys the reading by market id, never by pool (canon #3). */
export async function getBookDepth(target: BookTarget, depth = DEFAULT_BOOK_DEPTH): Promise<Reading<BookDepth>> {
  return withReading(`book:${target.marketId}:${depth}`, async () => {
    const book = await getClient().getBinaryOrderBook(target.poolAddress, { depth, decimals: target.decimals });
    return toBookDepth(book, target.decimals);
  });
}

/** Live-store book by market id — renders an empty book for a stale page rather than the successor market's liquidity. */
export function liveBookDepth(marketId: MarketId, decimals: number, depth = DEFAULT_BOOK_DEPTH): BookDepth {
  return toBookDepth(getClient().getLiveBinaryOrderBookByMarket(marketId, { depth }), decimals);
}

export async function getBookParams(poolAddress: Address): Promise<Reading<BookParams>> {
  return withReading(`bookParams:${poolAddress}`, async () => toBookParams(await getClient().getBinaryBookParams(poolAddress)));
}
