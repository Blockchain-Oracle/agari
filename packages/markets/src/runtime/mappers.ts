/**
 * Chain accounts → port shapes, pure (first-call.md §2.1–2.2). Prices are YES ticks `1..999`: `priceRaw = ticks ×
 * tick_base`, `quantityRaw = lots × lot_base`, cash = `lots × ticks × cash_unit`. Nothing here reads a clock or the
 * network; callers pass the chain-corrected `nowSec`.
 */
import type { Market } from "@agari/clients/agari-events";
import type { QuoteTarget } from "@agari/core/ports";
import { ONCHAIN_STATUS } from "@agari/core/lifecycle";
import { bookLevels, exitWalk, outcomeLevels, quoteStake, vwapOverDepth, type BookLevel, type NodeFilter } from "@agari/core/market";
import { bufferToSlippageBps, costCapBufferBps } from "@agari/core/sizing";
import type { Address as CoreAddress, BookDepth, BookLevelView, MarketId, OnchainSnapshot, OutcomeIdx, Quote, Side } from "@agari/core/types";
import { bpsToOddsCents, oneCent } from "@agari/core/units";
import type { Address } from "@solana/kit";
import type { SeriesFacts, VenueFacts } from "./accounts";
import type { BookState } from "./decode";

/** How many levels a side carries: the coordinated Book, the quote walk and `getBookDepth` all use it. */
export const BOOK_LEVELS = 32;
const PAIR_TICKS = 1000;
const TICKS_TO_BPS = 10;
const SLIPPAGE_MIN_TICKS = 10;
/** `PAYOUT_DENOMINATOR`: a winning side pays 10⁷ / 10⁷ (events-accounts.md §2). */
const PAYOUT_FULL = 10_000_000;

/** `Market.state` (events-accounts.md §2). */
export const MARKET_STATE = { open: 0, resolved: 1, voided: 2 } as const;
/** `Market.flags` bits. */
export const MARKET_FLAG = { bookReleased: 1, ledgerClosed: 2, singleSource: 4 } as const;

export interface MarketAccount {
  address: Address;
  data: Market;
}

/** events-engine.md §7 `status(m, now)` as core's on-chain enum; `Settling` is never observable. */
export function onchainStatus(m: Market, nowSec: number): number {
  if (m.state === MARKET_STATE.resolved) return ONCHAIN_STATUS.Resolved;
  if (m.state === MARKET_STATE.voided) return ONCHAIN_STATUS.Voided;
  if (nowSec < Number(m.tradingStart)) return ONCHAIN_STATUS.Listed;
  return nowSec < Number(m.lockAt) ? ONCHAIN_STATUS.Trading : ONCHAIN_STATUS.Locked;
}

export function winningOutcomeOf(payoutYes: number, payoutNo: number): OutcomeIdx | null {
  if (payoutYes === PAYOUT_FULL) return 0;
  if (payoutNo === PAYOUT_FULL) return 1;
  return null;
}

export function toOnchainSnapshot(m: MarketAccount, series: SeriesFacts, venue: VenueFacts, nowSec: number): OnchainSnapshot {
  const { data } = m;
  return {
    marketId: m.address as string as MarketId,
    marketAddress: m.address as string as CoreAddress,
    pool: data.book as string as CoreAddress,
    ledger: data.ledger as string as CoreAddress,
    nonce: data.index,
    collateral: venue.collateralMint as string as CoreAddress,
    status: onchainStatus(data, nowSec),
    backing: data.backingLots * series.lotBase,
    finalized: data.state !== MARKET_STATE.open,
    lockAtSec: Number(data.lockAt),
    expirySec: Number(data.expiry),
    decimals: venue.decimals,
    winningOutcome: winningOutcomeOf(data.payoutYes, data.payoutNo),
    isResolved: data.state === MARKET_STATE.resolved,
    isVoided: data.state === MARKET_STATE.voided,
  };
}

/** Live, unexpired nodes at the Book's own slot; resting age is not required of what a taker can hit. */
export function bookFilter(book: BookState, series: SeriesFacts, nowSec: number): NodeFilter {
  return { now: BigInt(nowSec), slot: book.slot, restedOnly: false, minRestSlots: series.minRestSlots };
}

function toLevels(levels: readonly BookLevel[], series: SeriesFacts, invert: boolean): BookLevelView[] {
  return levels.map(([ticks, lots]) => {
    const price = invert ? PAIR_TICKS - ticks : ticks;
    return { priceRaw: BigInt(price) * series.tickBase, priceBps: price * TICKS_TO_BPS, quantityRaw: lots * series.lotBase };
  });
}

/** The YES-quoted Book in Up/Down terms: Down asks are YES bids at `1000 − p`, Down bids are YES asks at `1000 − p`. */
export function toBookDepth(book: BookState, series: SeriesFacts, decimals: number, nowSec: number): BookDepth {
  const filter = bookFilter(book, series, nowSec);
  const bids = bookLevels(book.bids, "bid", BOOK_LEVELS, filter);
  const asks = bookLevels(book.asks, "ask", BOOK_LEVELS, filter);
  return {
    upBids: toLevels(bids, series, false),
    upAsks: toLevels(asks, series, false),
    downBids: toLevels(asks, series, true),
    downAsks: toLevels(bids, series, true),
    decimals,
  };
}

export const EMPTY_BOOK_DEPTH = (decimals: number): BookDepth => ({ upBids: [], upAsks: [], downBids: [], downAsks: [], decimals });

/**
 * The one quote kernel for the composing ticket (coordinated Book) and the click-time re-quote (fresh chain Book):
 * Up buys YES, Down buys NO, walking the crossed levels in the bought side's own terms. Null when nothing fits the
 * stake at `min_lots` or more. `quotedAtMs` is `nowSec × 1000`; a caller with a finer clock may overwrite it.
 */
export function quoteFromBook(book: BookState, series: SeriesFacts, target: QuoteTarget, side: Side, stakeBase: bigint, nowSec: number): Quote | null {
  const kind = side === "up" ? "BUY_YES" : "BUY_NO";
  const levels = outcomeLevels(kind, book.bids, book.asks, BOOK_LEVELS, bookFilter(book, series, nowSec));
  const slippageBps = bufferToSlippageBps(costCapBufferBps(target.intervalSec));
  const sized = quoteStake(levels, kind, stakeBase, series.cashUnit, series.minLots, slippageBps, SLIPPAGE_MIN_TICKS);
  if (!sized) return null;
  const contractsRaw = sized.lots * series.lotBase;
  const avgPriceBps = Number(vwapOverDepth(levels, sized.lots).vwapTicks) * TICKS_TO_BPS;
  return {
    side,
    stakeBase,
    contractsRaw,
    expectedCostBase: exitWalk(levels, sized.lots).proceeds * series.cashUnit,
    maxCostBase: sized.escrowCash,
    limitPriceRaw: BigInt(sized.yesPriceTicks) * series.tickBase,
    avgPriceBps,
    oddsCents: bpsToOddsCents(avgPriceBps),
    payoutIfRightBase: contractsRaw,
    fillableStakeBase: sized.escrowCash,
    partial: stakeBase - sized.escrowCash > oneCent(target.decimals),
    feeBps: 0,
    decimals: target.decimals,
    quotedAtMs: nowSec * 1000,
  };
}
