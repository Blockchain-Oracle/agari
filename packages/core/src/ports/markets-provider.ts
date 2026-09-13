import type { WalletHistory } from "../projection/types";
import type { Reading } from "../schemas/reading";
import type { AssetPrice, ClockSync, PricePoint, Resolution } from "../types/feeds";
import type { EventMarket, LaneSet, MarketId, OnchainSnapshot, Side } from "../types/market";
import type { Address, Bytes32 } from "../types/primitives";
import type { BalanceSheet, BookDepth, BookParams, ClaimableRow, Holdings, OpenPosition, Quote } from "../types/trading";
import type { VaultHoldings, VaultSnapshot } from "../vault/types";

/** What a book read needs to address a market: the id for recycle-safety plus the pool the book physically lives on. */
export interface BookTarget {
  marketId: MarketId;
  poolAddress: Address;
  decimals: number;
}

export interface QuoteTarget extends BookTarget {
  intervalSec: number;
}

/** The ONE chain port for reads (AD-1). Every method returns a `Reading<T>`; nothing here throws for a chain failure. */
export interface MarketsProvider {
  listLiveLanes(venueId: Bytes32): Promise<Reading<LaneSet>>;
  getMarket(marketId: MarketId): Promise<Reading<EventMarket | null>>;
  listSettled(venueId: Bytes32, limit?: number): Promise<Reading<EventMarket[]>>;
  getOnchain(marketId: MarketId): Promise<Reading<OnchainSnapshot>>;
  getBookDepth(target: BookTarget, depth?: number): Promise<Reading<BookDepth>>;
  getBookParams(poolAddress: Address): Promise<Reading<BookParams>>;
  /** Watch-free quote straight off the chain book — what the Submitter re-quotes with at click time. */
  freshQuoteStake(target: QuoteTarget, side: Side, stakeBase: bigint): Promise<Reading<Quote | null>>;
  getOpeningPrice(marketId: MarketId): Promise<Reading<bigint | null>>;
  getAssetPrice(asset: string): Promise<Reading<AssetPrice | null>>;
  getPriceHistory(asset: string, fromSec: number, toSec: number): Promise<Reading<PricePoint[]>>;
  settlementFeeBps(marketId: MarketId): Promise<Reading<number>>;
  listOpenPositions(wallet: Address): Promise<Reading<OpenPosition[]>>;
  getHoldings(wallet: Address, onchain: OnchainSnapshot): Promise<Reading<Holdings>>;
  listClaimables(wallet: Address, venueId: Bytes32): Promise<Reading<ClaimableRow[]>>;
  /** Every settled Window for a wallet, replayed from its fills — the one derivation history, PnL and Trader Edge share. */
  listWalletHistory(wallet: Address): Promise<Reading<WalletHistory>>;
  getBalanceSheet(wallet: Address): Promise<Reading<BalanceSheet>>;
  syncClock(): Promise<Reading<ClockSync>>;
  /** Chain-offset-corrected wall clock; raw device time never drives a phase. */
  nowMs(): number;
  nextWindow(market: EventMarket): Promise<Reading<EventMarket | null>>;
  getResolution(marketId: MarketId): Promise<Reading<Resolution>>;
  /** The Trading Balance and its live grants; `null` on a network with no EventVault deployment. */
  getVaultSnapshot(wallet: Address): Promise<Reading<VaultSnapshot | null>>;
  /** What the vault holds for the wallet on one Window; zeros (not an error) when there is no vault. */
  getVaultHoldings(wallet: Address, onchain: OnchainSnapshot): Promise<Reading<VaultHoldings>>;
}
