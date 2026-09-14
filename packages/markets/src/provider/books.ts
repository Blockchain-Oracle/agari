/**
 * Book reads straight from chain (first-call.md §2.2): the depth of one Window's Book, the Series grid a Book trades on,
 * and the click-time quote the submitter re-checks with. None of them touches the coordinator's subscription.
 * A Book bound to another Window (recycled, canon #3) reads empty for the Window that asked.
 */
import type { BookTarget, QuoteTarget } from "@agari/core/ports";
import type { Reading } from "@agari/core/schemas";
import type { Address, BookDepth, BookParams, Quote, Side } from "@agari/core/types";
import { getAddressDecoder } from "@solana/kit";
import { loadAccount } from "../runtime/account-loader";
import { readBook, readSeries } from "../runtime/accounts";
import { EMPTY_BOOK_DEPTH, quoteFromBook, toBookDepth } from "../runtime/mappers";
import { nowMs, nowSec } from "./clock";
import { withReading } from "./reading";

/** `Book.series` (struct offset 32 + the discriminator). */
const BOOK_SERIES_SLICE = { offset: 40, length: 32 } as const;

/** Levels are sliced to `depth` per side; the walk itself always reads the canonical 32. */
function sliceDepth(book: BookDepth, depth: number | undefined): BookDepth {
  if (depth === undefined) return book;
  return { ...book, upBids: book.upBids.slice(0, depth), upAsks: book.upAsks.slice(0, depth), downBids: book.downBids.slice(0, depth), downAsks: book.downAsks.slice(0, depth) };
}

export async function getBookDepth(target: BookTarget, depth?: number): Promise<Reading<BookDepth>> {
  return withReading(`book:${target.marketId}:${depth ?? "all"}`, async () => {
    const book = await readBook(target.poolAddress);
    if (!book || book.market !== (target.marketId as string)) return EMPTY_BOOK_DEPTH(target.decimals);
    return sliceDepth(toBookDepth(book, await readSeries(book.series), target.decimals, nowSec()), depth);
  });
}

/** The Series tick, lot and minimum a Book trades on; 32 bytes of the Book, then the (cached) Series. */
export async function getBookParams(poolAddress: Address): Promise<Reading<BookParams>> {
  return withReading(`bookParams:${poolAddress}`, async () => {
    const { bytes } = await loadAccount(poolAddress as string as Parameters<typeof loadAccount>[0], BOOK_SERIES_SLICE);
    if (!bytes) throw new Error(`Book ${poolAddress} not found`);
    const series = await readSeries(getAddressDecoder().decode(bytes));
    return { tickSizeRaw: series.tickBase, lotSizeRaw: series.lotBase, minQuantityRaw: series.minLots * series.lotBase };
  });
}

/** Watch-free: a fresh Book read, so the submitter never depends on subscription state (plan ruling #3). */
export async function freshQuoteStake(target: QuoteTarget, side: Side, stakeBase: bigint): Promise<Reading<Quote | null>> {
  return withReading(`quote:${target.marketId}:${side}:${stakeBase}`, async () => {
    const book = await readBook(target.poolAddress);
    if (!book || book.market !== (target.marketId as string)) return null;
    const quote = quoteFromBook(book, await readSeries(book.series), target, side, stakeBase, nowSec());
    return quote && { ...quote, quotedAtMs: nowMs() };
  });
}
