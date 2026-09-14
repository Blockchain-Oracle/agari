/**
 * Every chain read behind the `MarketsProvider` port, as the S1 stub answers them (D-015).
 *
 * Reads that need the chain return the not-deployed diagnosis. Reads whose honest answer is known without it keep
 * Masayume's "no deployment" shapes: no vault → `null` snapshot and zero holdings; the engine charges no settlement
 * fee (spec `events-engine.md` §8.2). Signatures follow the port; the Solana adapter (S4) replaces the bodies.
 */
import type { BookTarget, QuoteTarget } from "@agari/core/ports";
import type { WalletHistory } from "@agari/core/projection";
import { ok, type Reading } from "@agari/core/schemas";
import type { TickerSymbol } from "@agari/core/market";
import type {
  Address,
  AssetPrice,
  BalanceSheet,
  BookDepth,
  BookParams,
  ClaimableRow,
  ClockSync,
  EventMarket,
  Holdings,
  LaneSet,
  MarketId,
  OnchainSnapshot,
  OpenPosition,
  PricePoint,
  Quote,
  Resolution,
  Side,
} from "@agari/core/types";
import type { VaultHoldings, VaultSnapshot } from "@agari/core/vault";
import { notDeployedReading } from "../stub/not-deployed";
import { nowMs } from "./clock";

const unavailable = <T>(): Promise<Reading<T>> => Promise.resolve(notDeployedReading());

export const listLiveLanes = (_venueId: Address): Promise<Reading<LaneSet>> => unavailable();
export const getMarket = (_marketId: MarketId): Promise<Reading<EventMarket | null>> => unavailable();
/** Labels and expiries for several Windows in one round. */
export const getMarketsLite = (_marketIds: readonly MarketId[]): Promise<Reading<Map<MarketId, EventMarket>>> => unavailable();
export const listSettled = (_venueId: Address, _limit?: number): Promise<Reading<EventMarket[]>> => unavailable();
export const getOnchain = (_marketId: MarketId): Promise<Reading<OnchainSnapshot>> => unavailable();
export const getBookDepth = (_target: BookTarget, _depth?: number): Promise<Reading<BookDepth>> => unavailable();
export const getBookParams = (_book: Address): Promise<Reading<BookParams>> => unavailable();
export const freshQuoteStake = (_target: QuoteTarget, _side: Side, _stakeBase: bigint): Promise<Reading<Quote | null>> => unavailable();
export const getOpeningPrice = (_marketId: MarketId): Promise<Reading<bigint | null>> => unavailable();
/** Spot arrives over price-relay SSE from S3. */
export const getAssetPrice = (_asset: TickerSymbol): Promise<Reading<AssetPrice | null>> => unavailable();
export const getPriceHistory = (_asset: TickerSymbol, _fromSec: number, _toSec: number): Promise<Reading<PricePoint[]>> => unavailable();
export const listOpenPositions = (_wallet: Address): Promise<Reading<OpenPosition[]>> => unavailable();
export const getHoldings = (_wallet: Address, _onchain: OnchainSnapshot): Promise<Reading<Holdings>> => unavailable();
export const listClaimables = (_wallet: Address, _venueId: Address): Promise<Reading<ClaimableRow[]>> => unavailable();
export const listWalletHistory = (_wallet: Address): Promise<Reading<WalletHistory>> => unavailable();
export const getBalanceSheet = (_wallet: Address): Promise<Reading<BalanceSheet>> => unavailable();
export const nextWindow = (_market: EventMarket): Promise<Reading<EventMarket | null>> => unavailable();
export const getResolution = (_marketId: MarketId): Promise<Reading<Resolution>> => unavailable();

/** The engine has no settlement fee: redeem pays `⌊amount × numerator / 10⁷⌋` (D-012, core `estPayoutBase`). */
export async function settlementFeeBps(_marketId: MarketId): Promise<Reading<number>> {
  return ok(0, nowMs());
}

/** The chain head is only worth sampling once there is a program to trade against; until then device time stands. */
export const syncClock = (): Promise<Reading<ClockSync>> => unavailable();

/** No EventVault on this cluster yet (S7): the port's honest `null`. */
export async function getVaultSnapshot(_wallet: Address): Promise<Reading<VaultSnapshot | null>> {
  return ok(null, nowMs());
}

/** No EventVault on this cluster yet (S7): zeros, never an error. */
export async function getVaultHoldings(_wallet: Address, onchain: OnchainSnapshot): Promise<Reading<VaultHoldings>> {
  return ok({ marketId: onchain.marketId, upRaw: 0n, downRaw: 0n, upGrantId: 0n, downGrantId: 0n }, nowMs());
}

/** A wallet's tUSDC balance (needs the mint, S2). */
export const getWalletCollateral = (_wallet: Address): Promise<Reading<{ amountBase: bigint; decimals: number; symbol: string }>> => unavailable();

/**
 * Where a send's recovery search starts: the slot before an actor sends a grant-scoped order, so a lost reply is
 * found by its program events rather than resent (AD-3). Solana has no account nonce; the signature and slot are it.
 */
export const readRecoveryCursor = (): Promise<Reading<{ fromSlot: bigint }>> => unavailable();

/** Next start for an empty lane: the Series' last expiry (contiguous Windows). */
export const laneNextStart = (_venueId: Address, _intervalSec: number): Promise<Reading<number | null>> => unavailable();
