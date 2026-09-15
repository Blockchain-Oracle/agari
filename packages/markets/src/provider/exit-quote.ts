/**
 * The plain cash-out's exit quote (L-35, tap-trading.md §1.4, D-067): a watch-free walk of the Book for the side being
 * sold. Up sells YES into the bids as they are; Down sells NO into the asks inverted (events-engine.md §9). The limit
 * is the last level reached padded down, the mirror of `quote_stake`'s padding, and `minProceeds` is what a fill at
 * that limit pays at least. Null when nothing would fill; a Window that is not trading is an error reading.
 */
import { ONCHAIN_STATUS } from "@agari/core/lifecycle";
import { exitWalk, outcomeLevels } from "@agari/core/market";
import type { QuoteTarget } from "@agari/core/ports";
import type { Reading } from "@agari/core/schemas";
import { diagnosis, type ExitQuote, type Side } from "@agari/core/types";
import { ReadingError } from "../errors/reading-error";
import { readBook, readMarket, readSeries, type BookState, type SeriesFacts } from "../runtime/accounts";
import { BOOK_LEVELS, bookFilter, onchainStatus } from "../runtime/mappers";
import { nowSec } from "./clock";
import { withReading } from "./reading";

const PAIR_TICKS = 1000;
const TICKS_TO_BPS = 10n;
const SLIPPAGE_BPS = 300;
const SLIPPAGE_MIN_TICKS = 10;

export const NO_EXIT_LIQUIDITY = "No exit liquidity right now";
export const EXIT_LOCKED = "No exit liquidity: this Window has locked, it pays at settlement";

/**
 * The pure exit kernel: sell up to `heldLots` of `side`. `lots = min(held, filled)`; the own-terms limit is the last
 * level reached minus `max(⌊p × 300 / 10,000⌋, 10)` ticks, floored at 1, and the order's YES-terms price is
 * `up ? limit : 1000 − limit`. Null when nothing fills or the fillable size is below the Series minimum.
 */
export function exitQuoteFromBook(book: BookState, series: SeriesFacts, side: Side, heldLots: bigint, nowSecs: number): ExitQuote | null {
  if (heldLots <= 0n) return null;
  const kind = side === "up" ? "SELL_YES" : "SELL_NO";
  const levels = outcomeLevels(kind, book.bids, book.asks, BOOK_LEVELS, bookFilter(book, series, nowSecs));
  const { proceeds, filled } = exitWalk(levels, heldLots);
  const lots = filled < heldLots ? filled : heldLots;
  if (lots === 0n || lots < series.minLots) return null;
  let reached = 0;
  let taken = 0n;
  for (const [price, available] of levels) {
    if (taken >= lots) break;
    taken += available;
    reached = price;
  }
  const padding = Math.max(Math.floor((reached * SLIPPAGE_BPS) / 10_000), SLIPPAGE_MIN_TICKS);
  const limitOwn = Math.max(reached - padding, 1);
  const yesTicks = side === "up" ? limitOwn : PAIR_TICKS - limitOwn;
  return {
    contractsRaw: lots * series.lotBase,
    limitPriceRaw: BigInt(yesTicks) * series.tickBase,
    expectedProceedsBase: proceeds * series.cashUnit,
    minProceedsBase: lots * BigInt(limitOwn) * series.cashUnit,
    avgPriceBps: Number((proceeds * TICKS_TO_BPS) / lots),
  };
}

/** Why a Window can't be cashed out of right now, or null while it trades. */
export function exitRefusalOf(status: number): ReadingError | null {
  return status === ONCHAIN_STATUS.Trading ? null : new ReadingError(diagnosis("market-not-trading", EXIT_LOCKED));
}

export async function freshExitQuote(target: QuoteTarget, side: Side, contractsRaw: bigint): Promise<Reading<ExitQuote | null>> {
  return withReading(`exit:${target.marketId}:${side}:${contractsRaw}`, async () => {
    const [market, book] = await Promise.all([readMarket(target.marketId), readBook(target.poolAddress)]);
    if (!market) throw new ReadingError(diagnosis("market-not-trading", EXIT_LOCKED));
    const refusal = exitRefusalOf(onchainStatus(market.data, nowSec()));
    if (refusal) throw refusal;
    if (!book || book.market !== (target.marketId as string)) return null;
    const series = await readSeries(book.series);
    return exitQuoteFromBook(book, series, side, contractsRaw / series.lotBase, nowSec());
  });
}
