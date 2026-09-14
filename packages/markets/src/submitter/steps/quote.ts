import { admissibilityBlocker, belowMinStake } from "@agari/core/sizing";
import { diagnosis, type EventMarket, type Quote, type Side } from "@agari/core/types";
import { msToSec } from "@agari/core/units";
import { readBook, type SeriesFacts } from "../../runtime/accounts";
import { quoteFromBook } from "../../runtime/mappers";
import { OrderRefusedError, RequoteError } from "../errors";

export interface QuoteInput {
  market: EventMarket;
  series: SeriesFacts;
  side: Side;
  stakeBase: bigint;
}

/**
 * A watch-free quote straight off the chain Book (never the subscription): null when nothing is fillable, or the Book
 * is bound to another Window (recycled, canon #3). A failed read refuses with `rpc-down`.
 */
export async function readFreshQuote({ market, series, side, stakeBase }: QuoteInput, nowMs: number): Promise<Quote | null> {
  let book: Awaited<ReturnType<typeof readBook>>;
  try {
    book = await readBook(market.poolAddress);
  } catch (error) {
    throw new OrderRefusedError(diagnosis("rpc-down", `could not read a fresh book: ${error instanceof Error ? error.message : String(error)}`));
  }
  if (!book || book.market !== (market.marketId as string)) return null;
  const target = { marketId: market.marketId, poolAddress: market.poolAddress, decimals: market.decimals, intervalSec: market.intervalSec };
  return quoteFromBook(book, series, target, side, stakeBase, msToSec(nowMs));
}

/**
 * Re-quotes at click time (FR-9, Masayume `steps/quote.ts`). Nothing fillable, an inadmissible price or a stake below
 * the floor refuses; a fresh escrow above the confirmed one is surfaced as a requote, never sent. Odds drifting inside
 * the confirmed escrow are accepted by design: the max loss is still what was shown.
 */
export async function freshQuote(input: QuoteInput & { displayed: Quote }, nowMs: number): Promise<Quote> {
  if (belowMinStake(input.stakeBase, input.market.decimals)) {
    throw new OrderRefusedError(diagnosis("below-min-quantity", `stake ${input.stakeBase} is below the minimum`));
  }
  const quote = await readFreshQuote(input, nowMs);
  if (!quote) throw new OrderRefusedError(diagnosis("no-liquidity", `nothing fillable for ${input.stakeBase} on the ${input.side} side`));
  const band = admissibilityBlocker(quote.avgPriceBps);
  if (band) throw new OrderRefusedError(diagnosis("outside-band", `${band}: the book quotes ${quote.avgPriceBps} bps`));
  if (quote.maxCostBase > input.displayed.maxCostBase) throw new RequoteError(quote);
  return quote;
}

/** After an IOC that would fill nothing: the book moved, so ask again (first-call.md §3.1, 6110 in simulation). */
export async function requoteAfterNoFill(input: QuoteInput, nowMs: number): Promise<Quote> {
  const quote = await readFreshQuote(input, nowMs);
  if (!quote) throw new OrderRefusedError(diagnosis("no-liquidity", `the book moved: nothing fillable for ${input.stakeBase} on the ${input.side} side`));
  throw new RequoteError(quote);
}
