import type { MarketsProvider } from "@agari/core/ports";
import { nowMs } from "./clock";
import {
  freshQuoteStake,
  getAssetPrice,
  getBalanceSheet,
  getBookDepth,
  getBookParams,
  getHoldings,
  getMarket,
  getOnchain,
  getOpeningPrice,
  getPriceHistory,
  getResolution,
  getVaultHoldings,
  getVaultSnapshot,
  listClaimables,
  listLiveLanes,
  listOpenPositions,
  listSettled,
  listWalletHistory,
  nextWindow,
  settlementFeeBps,
  syncClock,
} from "./reads";

/** The one read port every surface plugs into (AD-1): chain, indexer and ops behind one shape (first-call.md §2). */
export const marketsProvider: MarketsProvider = {
  listLiveLanes,
  getMarket,
  listSettled,
  getOnchain,
  getBookDepth,
  getBookParams,
  freshQuoteStake,
  getOpeningPrice,
  getAssetPrice,
  getPriceHistory,
  settlementFeeBps,
  listOpenPositions,
  getHoldings,
  listClaimables,
  listWalletHistory,
  getBalanceSheet,
  syncClock,
  nowMs,
  nextWindow,
  getResolution,
  getVaultSnapshot,
  getVaultHoldings,
};

export { bootMarkets, type MarketsBoot } from "./boot";
export { applyClockSync, lastClockSync, nowMs, nowSec } from "./clock";
export { getMarketsLite, getWalletCollateral, laneNextStart, listWalletFills, readRecoveryCursor, syncClock, type WalletFillsQuery } from "./reads";
export { forgetReading, unwrap, withReading, type Unwrap } from "./reading";
export {
  mapPool,
  readVenueBoard,
  toRoundMarket,
  type BoardScope,
  type ScanScope,
  type TractionCall,
  type TractionPoint,
  type VenueBoard,
  type VenueTraction,
} from "./tape";
