import { bookLevels, type NodeFilter } from "@agari/core/market";
import type { YesLevel } from "@agari/core/leverage";
import { diagnosis, type MarketId, type Side } from "@agari/core/types";
import { ReadingError } from "../errors/reading-error";
import { nowSec } from "../provider/clock";
import { readBook, readMarket, readSeries } from "../runtime/accounts";

/** Levels read per side, as the program reads them (`LEVELS` in `agari-leverage`). */
const LEVELS = 32;
const PAIR_TICKS = 1_000n;

export interface BoostBook {
  /** The side an open takes, every live order, in YES terms. */
  entry: YesLevel[];
  /** The side an exit meets, every live order: what an owner's own cash-out would fill against. */
  exitResting: YesLevel[];
  /** The same side, rested orders only (PD-2): what the chain marks a position against. */
  exitRested: YesLevel[];
  one: bigint;
  lotRaw: bigint;
  minQuantityRaw: bigint;
  expirySec: number;
  decimals: number;
}

/**
 * One Window's book as `agari-leverage` reads it, in the client's units (`ticks × tickBase`, `lots × lotBase`).
 *
 * Every price is a YES price whichever side is bought, because that is what the engine quotes and what the program
 * walks: an Up open takes asks and exits into bids, a Down open takes bids and exits into asks.
 */
export async function readBoostBook(marketId: MarketId, side: Side): Promise<BoostBook> {
  const market = await readMarket(marketId);
  if (!market) throw new ReadingError(diagnosis("market-not-trading", `Window not found: ${marketId}`));
  const [series, book] = await Promise.all([readSeries(market.data.series), readBook(market.data.book)]);
  if (!book) throw new ReadingError(diagnosis("thin-book", `no Book for Window ${marketId}`));

  const resting: NodeFilter = { now: BigInt(nowSec()), slot: book.slot, restedOnly: false, minRestSlots: series.minRestSlots };
  const rested: NodeFilter = { ...resting, restedOnly: true };
  const up = side === "up";
  const scale = (levels: readonly (readonly [number, bigint])[]): YesLevel[] =>
    levels.map(([ticks, lots]) => ({ priceRaw: BigInt(ticks) * series.tickBase, quantityRaw: lots * series.lotBase }));
  const take = (filter: NodeFilter) => scale(up ? bookLevels(book.asks, "ask", LEVELS, filter) : bookLevels(book.bids, "bid", LEVELS, filter));
  const hit = (filter: NodeFilter) => scale(up ? bookLevels(book.bids, "bid", LEVELS, filter) : bookLevels(book.asks, "ask", LEVELS, filter));

  const one = series.tickBase * PAIR_TICKS;
  return {
    entry: take(resting),
    exitResting: hit(resting),
    exitRested: hit(rested),
    one,
    lotRaw: series.lotBase,
    minQuantityRaw: series.minLots * series.lotBase,
    expirySec: Number(market.data.expiry),
    decimals: one.toString().length - 1,
  };
}
