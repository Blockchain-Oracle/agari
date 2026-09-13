import type { Bytes32, MarketId } from "@masayume/core/types";
import { QUERY_KEY_SCOPE, marketFeesKey, marketOnchainKey } from "@somnia-chain/markets-sdk";

const APP = "masayume";

/** Query keys for every port read; SDK factories are reused where the SDK defines one so caches never fork. */
export const keys = {
  /** The boot facts share this prefix, so invalidating it retries all three at once. */
  boot: () => [QUERY_KEY_SCOPE, APP, "boot"] as const,
  /** Collateral decimals — read once per chain, needed before any money is formatted or moved. */
  collateral: () => [QUERY_KEY_SCOPE, APP, "boot", "collateral"] as const,
  /** The live venue id — needed by venue-scoped reads, which is most public market discovery. */
  venue: () => [QUERY_KEY_SCOPE, APP, "boot", "venue"] as const,
  lanes: (venueId: string | null) => [QUERY_KEY_SCOPE, APP, "lanes", venueId] as const,
  market: (marketId: string | null) => [QUERY_KEY_SCOPE, APP, "market", marketId] as const,
  /** A set of Windows read together, keyed on their joined ids. */
  marketsLite: (ids: string) => [QUERY_KEY_SCOPE, APP, "marketsLite", ids] as const,
  openingPrice: (marketId: string | null) => [QUERY_KEY_SCOPE, APP, "opening", marketId] as const,
  assetPrice: (asset: string | null) => [QUERY_KEY_SCOPE, APP, "assetPrice", asset] as const,
  priceHistory: (asset: string | null, fromSec: number, toSec: number) => [QUERY_KEY_SCOPE, APP, "priceHistory", asset, fromSec, toSec] as const,
  bookParams: (pool: string | null) => [QUERY_KEY_SCOPE, APP, "bookParams", pool] as const,
  resolution: (marketId: string | null) => [QUERY_KEY_SCOPE, APP, "resolution", marketId] as const,
  positions: (wallet: string | null) => [QUERY_KEY_SCOPE, APP, "positions", wallet] as const,
  /** Nested under the wallet's positions so one invalidation after a write refreshes both. */
  holdings: (wallet: string | null, marketId: string | null) => [QUERY_KEY_SCOPE, APP, "positions", wallet, "holdings", marketId] as const,
  claimables: (wallet: string | null, venueId: Bytes32 | null) => [QUERY_KEY_SCOPE, APP, "claimables", wallet, venueId] as const,
  /** The fill projection: settled rounds, equity, stats — one key, so a claim or an order refreshes all of it. */
  history: (wallet: string | null) => [QUERY_KEY_SCOPE, APP, "history", wallet] as const,
  /** The Trading Balance and its grants; holdings nest under it so one invalidation refreshes both. */
  vault: (wallet: string | null) => [QUERY_KEY_SCOPE, APP, "vault", wallet] as const,
  vaultHoldings: (wallet: string | null, marketId: string | null) => [QUERY_KEY_SCOPE, APP, "vault", wallet, "holdings", marketId] as const,
  /** The reserve's own sheet, and one wallet's tickets. */
  parlayReserve: () => [QUERY_KEY_SCOPE, APP, "parlayReserve"] as const,
  parlays: (wallet: string | null) => [QUERY_KEY_SCOPE, APP, "parlays", wallet] as const,
  parlayQuote: (signature: string) => [QUERY_KEY_SCOPE, APP, "parlayQuote", signature] as const,
  /** The range reserve's sheet, one wallet's rounds, a Window's basis and a band's quote. */
  rangeReserve: () => [QUERY_KEY_SCOPE, APP, "rangeReserve"] as const,
  ranges: (wallet: string | null) => [QUERY_KEY_SCOPE, APP, "ranges", wallet] as const,
  rangeBasis: (marketId: string | null, asset: string | null) => [QUERY_KEY_SCOPE, APP, "rangeBasis", marketId, asset] as const,
  rangeQuote: (signature: string) => [QUERY_KEY_SCOPE, APP, "rangeQuote", signature] as const,
  /** The maker vault's sheet, its open Windows and history, one wallet's shares. */
  makerVault: () => [QUERY_KEY_SCOPE, APP, "makerVault"] as const,
  makerWindows: () => [QUERY_KEY_SCOPE, APP, "makerVault", "windows"] as const,
  makerHistory: (limit: number) => [QUERY_KEY_SCOPE, APP, "makerVault", "history", limit] as const,
  makerShares: (wallet: string | null) => [QUERY_KEY_SCOPE, APP, "makerShares", wallet] as const,
  /** The leverage reserve's sheet, one wallet's boosts, a boost's live mark and a stake's quote. */
  leverageReserve: () => [QUERY_KEY_SCOPE, APP, "leverageReserve"] as const,
  leveragePositions: (wallet: string | null) => [QUERY_KEY_SCOPE, APP, "leverage", wallet] as const,
  leverageMark: (positionId: string | null) => [QUERY_KEY_SCOPE, APP, "leverageMark", positionId] as const,
  leverageQuote: (signature: string) => [QUERY_KEY_SCOPE, APP, "leverageQuote", signature] as const,
  /** The private desk's sheet, one wallet's budget, a stake's quote and one slot. */
  privateDesk: () => [QUERY_KEY_SCOPE, APP, "privateDesk"] as const,
  privateBudget: (wallet: string | null) => [QUERY_KEY_SCOPE, APP, "privateBudget", wallet] as const,
  privateQuote: (signature: string) => [QUERY_KEY_SCOPE, APP, "privateQuote", signature] as const,
  privateSlot: (slotId: string | null) => [QUERY_KEY_SCOPE, APP, "privateSlot", slotId] as const,
  /** The arena's sheet, one match whole, one wallet's unclaimed credit and a stake's size on one card. */
  arenaState: () => [QUERY_KEY_SCOPE, APP, "arena"] as const,
  arenaMatch: (matchId: string | null) => [QUERY_KEY_SCOPE, APP, "arena", "match", matchId] as const,
  arenaCredit: (wallet: string | null) => [QUERY_KEY_SCOPE, APP, "arena", "credit", wallet] as const,
  arenaQuote: (signature: string) => [QUERY_KEY_SCOPE, APP, "arenaQuote", signature] as const,
  balanceSheet: (wallet: string | null) => [QUERY_KEY_SCOPE, APP, "balanceSheet", wallet] as const,
  walletCollateral: (wallet: string | null) => [QUERY_KEY_SCOPE, APP, "walletCollateral", wallet] as const,
  nextWindow: (marketId: MarketId | null) => [QUERY_KEY_SCOPE, APP, "nextWindow", marketId] as const,
  /** Nested under the boot prefix so the boot fact and `useClock` are one cache entry, not two chain reads. */
  clock: () => [QUERY_KEY_SCOPE, APP, "boot", "clock"] as const,
  onchain: (marketId: MarketId | null) => marketOnchainKey(marketId),
  fee: (marketId: MarketId | null) => marketFeesKey(marketId),
};
