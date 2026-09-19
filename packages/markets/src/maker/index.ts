/** MarketMakerVault (Earn) on Solana is `agari-maker` (S8). Until deployed: empty reads; the book top needs the engine (S4). */
import type { MakerDeployment, MakerVaultState, MakerWindowView } from "@agari/core/maker";
import type { Reading } from "@agari/core/schemas";
import type { Address, MarketId } from "@agari/core/types";
import type { MarketsEnv } from "../env";
import { bookLevels, type BookLevel } from "@agari/core/market";
import { nowMs } from "../provider/clock";
import { readBook, readSeries } from "../runtime/accounts";
import { bookFilter } from "../runtime/mappers";
import { notDeployedError } from "../stub/not-deployed";
import { absent } from "../stub/product";

/** The best level a side, the depth over the first levels, and the grid, in raw units. */
export interface PoolTop {
  bestBidRaw: bigint | null;
  bestAskRaw: bigint | null;
  bidDepthRaw: bigint;
  askDepthRaw: bigint;
  tickRaw: bigint;
  lotRaw: bigint;
  minQuantityRaw: bigint;
}

export { getMakerSharesOf, getMakerVaultState, getMakerWindow, makerProgramId, resolveMakerDeployment, windowBookAddress } from "./reads";
export const listMakerOpenWindows = (): Promise<Reading<MakerWindowView[]>> => absent([]);
export const listMakerHistory = (_limit = 20, _offset = 0): Promise<Reading<MakerWindowView[]>> => absent([]);
export const getMakerUnsettledExpired = (): Promise<Reading<MarketId | null>> => absent(null);

/**
 * The maker's view of one Window's Book: the best level each side, the depth over the first `levels`, and the
 * grid the Series trades on.
 *
 * The quoting actor decides where to rest from this, so it applies the same rested-order filter every other read
 * does — an order placed in the last few slots, or already expired, is not depth the vault can quote against.
 * Both sides are reported in YES terms, which is how the book is quoted: the ask side rests BUY_NO orders whose
 * YES-equivalent price is `1000 − their NO price`.
 */
export async function readPoolTop(bookAddress: Address, levels = 5): Promise<PoolTop> {
  const book = await readBook(bookAddress);
  if (!book) throw notDeployedError(`Book ${bookAddress} is not readable`);
  const series = await readSeries(book.series);
  const filter = bookFilter(book, series, Math.floor(nowMs() / 1000));
  const bids = bookLevels(book.bids, "bid", levels, filter);
  const asks = bookLevels(book.asks, "ask", levels, filter);
  const depth = (rows: readonly BookLevel[]) => rows.reduce((total, [, lots]) => total + lots, 0n);
  return {
    bestBidRaw: bids[0] ? BigInt(bids[0][0]) : null,
    bestAskRaw: asks[0] ? BigInt(asks[0][0]) : null,
    bidDepthRaw: depth(bids),
    askDepthRaw: depth(asks),
    tickRaw: series.tickBase,
    lotRaw: series.lotBase,
    minQuantityRaw: series.minLots,
  };
}
