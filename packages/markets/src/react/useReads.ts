import { CLOCK_RESYNC_MS, MARKETS_POLL_MS, ONCHAIN_POLL_MS, OPENING_PRINT_POLL_MS, SETTLED_HISTORY_POLL_MS } from "@agari/core/constants";
import type { ArenaQuote, Pick } from "@agari/core/games";
import type { LeverageMark, LeveragePosition, LeverageReserveState } from "@agari/core/leverage";
import type { MakerVaultState, MakerWindowView } from "@agari/core/maker";
import type { TickerSymbol } from "@agari/core/market";
import type { ParlayReserveState, ParlayTicket } from "@agari/core/parlay";
import type { PrivateBudget, PrivateDeskState, PrivateSlot } from "@agari/core/private";
import type { ProviderShares } from "@agari/core/reserves";
import type { WalletHistory } from "@agari/core/projection";
import type { RangeReserveState, RangeRound } from "@agari/core/range";
import { isOk, type Reading } from "@agari/core/schemas";
import type { Address, BalanceSheet, BookParams, ClaimableRow, ClockSync, EventMarket, Hash32, LaneBasis, LaneSet, MarketId, OnchainSnapshot, OpenPosition, PricePoint, Resolution } from "@agari/core/types";
import type { VaultHoldings, VaultSnapshot } from "@agari/core/vault";
import { getArenaCredit, getArenaMatch, getArenaState, quoteArenaPick, type ArenaMatchView, type ArenaState } from "../games/read";
import { getLeverageMark, getLeverageReserveState, getLeverageSharesOf, listLeveragePositionsOf } from "../leverage";
import { getMakerSharesOf, getMakerVaultState, listMakerHistory, listMakerOpenWindows } from "../maker";
import { getParlayReserveState, getParlaySharesOf, listParlaysOf } from "../parlay";
import { mark } from "../perf/milestones";
import { getPrivateBudget, getPrivateDeskState, getPrivateSlot } from "../private";
import {
  getBalanceSheet,
  getBookParams,
  getMarket,
  getMarketsLite,
  getOnchain,
  getOpeningPrice,
  getPriceHistory,
  getResolution,
  getVaultHoldings,
  getVaultSnapshot,
  listClaimables,
  listLiveLanes,
  listOpenPositions,
  listWalletHistory,
  nextWindow,
  settlementFeeBps,
  syncClock,
} from "../provider/reads";
import { getRangeReserveState, getRangeSharesOf, listRangesOf, previewRangeBasis, type RangeWindowBasis } from "../range/read";
import { keys } from "./keys";
import { useReadingQuery } from "./useReadingQuery";

/**
 * Product reads answer "not deployed" from their own deployment check, without the chain, so they don't wait on
 * the boot facts: gating them would turn Masayume's CapabilityPending into an error until each program ships.
 */
const PRODUCT = { needs: [] } as const;

export function useLanes(venueId: Address | null): Reading<LaneSet> | null {
  const reading = useReadingQuery(keys.lanes(venueId), () => listLiveLanes(venueId as Address), {
    pollMs: MARKETS_POLL_MS,
    enabled: venueId !== null,
    needs: ["venue"],
  });
  if (reading && isOk(reading)) mark("lanes.first");
  return reading;
}

/** Labels and expiries for a set of Windows in one round (no opening prints) — a table of ten does not wait ten times. */
export function useMarketsLite(marketIds: readonly MarketId[]): Reading<Map<MarketId, EventMarket>> | null {
  const signature = marketIds.join(",");
  return useReadingQuery(keys.marketsLite(signature), () => getMarketsLite(signature ? (signature.split(",") as MarketId[]) : []), {
    pollMs: MARKETS_POLL_MS,
    enabled: marketIds.length > 0,
  });
}

export function useMarket(marketId: MarketId | null): Reading<EventMarket | null> | null {
  return useReadingQuery(keys.market(marketId), () => getMarket(marketId as MarketId), { pollMs: MARKETS_POLL_MS, enabled: marketId !== null });
}

/** Polls only while the print is still pending; a print, once seen, never changes (FR-7). */
export function useOpeningPrice(marketId: MarketId | null): Reading<bigint | null> | null {
  return useReadingQuery(keys.openingPrice(marketId), () => getOpeningPrice(marketId as MarketId), {
    enabled: marketId !== null,
    pollMs: (reading) => (reading && isOk(reading) && reading.value !== null ? false : OPENING_PRINT_POLL_MS),
  });
}

/** A ticker's recorded prints; pass the Window's `basis` so a stock lane and its 24/7 xStock lane never share a line. */
export function usePriceHistory(asset: TickerSymbol | null, fromSec: number, toSec: number, basis?: LaneBasis): Reading<PricePoint[]> | null {
  return useReadingQuery(keys.priceHistory(asset, fromSec, toSec, basis ?? null), () => getPriceHistory(asset as TickerSymbol, fromSec, toSec, basis), {
    enabled: asset !== null,
    staleTimeMs: Number.POSITIVE_INFINITY,
  });
}

export function useOnchain(marketId: MarketId | null, pollMs: number | false = ONCHAIN_POLL_MS): Reading<OnchainSnapshot> | null {
  return useReadingQuery(keys.onchain(marketId), () => getOnchain(marketId as MarketId), { enabled: marketId !== null, pollMs: pollMs || undefined });
}

/** A Book's tick, lot and minimum — constant for the Series, so read once and kept (the same entry `useStakeQuote` shares). */
export function useBookParams(poolAddress: Address | null): Reading<BookParams> | null {
  return useReadingQuery(keys.bookParams(poolAddress), () => getBookParams(poolAddress as Address), {
    enabled: poolAddress !== null,
    staleTimeMs: Number.POSITIVE_INFINITY,
  });
}

/** The settlement fee for one market, read at use time (the engine charges none, D-012). */
export function useSettlementFee(marketId: MarketId | null): Reading<number> | null {
  return useReadingQuery(keys.fee(marketId), () => settlementFeeBps(marketId as MarketId), { enabled: marketId !== null });
}

export function useResolution(marketId: MarketId | null): Reading<Resolution> | null {
  return useReadingQuery(keys.resolution(marketId), () => getResolution(marketId as MarketId), { enabled: marketId !== null });
}

export function usePositions(wallet: Address | null): Reading<OpenPosition[]> | null {
  return useReadingQuery(keys.positions(wallet), () => listOpenPositions(wallet as Address), { pollMs: MARKETS_POLL_MS, enabled: wallet !== null });
}

export function useClaimables(wallet: Address | null, venueId: Address | null): Reading<ClaimableRow[]> | null {
  return useReadingQuery(keys.claimables(wallet, venueId), () => listClaimables(wallet as Address, venueId as Address), {
    pollMs: MARKETS_POLL_MS,
    enabled: wallet !== null && venueId !== null,
  });
}

export function useBalanceSheet(wallet: Address | null): Reading<BalanceSheet> | null {
  return useReadingQuery(keys.balanceSheet(wallet), () => getBalanceSheet(wallet as Address), { pollMs: MARKETS_POLL_MS, enabled: wallet !== null });
}

/** Settled history for a wallet — one reading shared by the ledger rows, the equity curve, Trader Edge and the badges. */
export function useWalletHistory(wallet: Address | null, enabled = true): Reading<WalletHistory> | null {
  return useReadingQuery(keys.history(wallet), () => listWalletHistory(wallet as Address), {
    pollMs: SETTLED_HISTORY_POLL_MS,
    enabled: enabled && wallet !== null,
  });
}

export function useNextWindow(market: EventMarket | null): Reading<EventMarket | null> | null {
  return useReadingQuery(keys.nextWindow(market?.marketId ?? null), () => nextWindow(market as EventMarket), { enabled: market !== null });
}

export function useClock(): Reading<ClockSync> | null {
  return useReadingQuery(keys.clock(), syncClock, { pollMs: CLOCK_RESYNC_MS });
}

/** The Trading Balance and the live grant per kind; `null` inside the reading where no vault is deployed. */
export function useVaultSnapshot(wallet: Address | null): Reading<VaultSnapshot | null> | null {
  return useReadingQuery(keys.vault(wallet), () => getVaultSnapshot(wallet as Address), { ...PRODUCT, pollMs: MARKETS_POLL_MS, enabled: wallet !== null });
}

/** The reserve's sheet and tunables; `null` inside the reading where no reserve is deployed. */
export function useParlayReserve(enabled = true): Reading<ParlayReserveState | null> | null {
  return useReadingQuery(keys.parlayReserve(), getParlayReserveState, { ...PRODUCT, pollMs: MARKETS_POLL_MS, enabled });
}

/** One wallet's tickets, live first; empty (never an error) without a reserve. */
export function useMyParlays(wallet: Address | null): Reading<ParlayTicket[]> | null {
  return useReadingQuery(keys.parlays(wallet), () => listParlaysOf(wallet as Address), { ...PRODUCT, pollMs: MARKETS_POLL_MS, enabled: wallet !== null });
}

/** One wallet's parlay reserve shares and their worth; zeros without a reserve. */
export function useParlayShares(wallet: Address | null): Reading<ProviderShares> | null {
  return useReadingQuery(keys.parlayShares(wallet), () => getParlaySharesOf(wallet as Address), { ...PRODUCT, pollMs: MARKETS_POLL_MS, enabled: wallet !== null });
}

/** The range reserve's sheet and tunables; `null` inside the reading where no reserve is deployed. */
export function useRangeReserve(enabled = true): Reading<RangeReserveState | null> | null {
  return useReadingQuery(keys.rangeReserve(), getRangeReserveState, { ...PRODUCT, pollMs: MARKETS_POLL_MS, enabled });
}

/**
 * The basis the range reserve would price one Window on right now: its opening print, the venue's implied centre
 * and the house σ. The ticket builds its band from this so the page and the chain share one middle (D-119).
 */
export function useRangeBasis(marketId: MarketId | null): Reading<RangeWindowBasis> | null {
  return useReadingQuery(keys.rangeBasis(marketId, null), () => previewRangeBasis(marketId as MarketId), { ...PRODUCT, pollMs: MARKETS_POLL_MS, enabled: marketId !== null });
}

/** One wallet's range rounds, live first; empty (never an error) without a reserve. */
export function useMyRanges(wallet: Address | null): Reading<RangeRound[]> | null {
  return useReadingQuery(keys.ranges(wallet), () => listRangesOf(wallet as Address), { ...PRODUCT, pollMs: MARKETS_POLL_MS, enabled: wallet !== null });
}

/** One wallet's range reserve shares and their worth; zeros without a reserve. */
export function useRangeShares(wallet: Address | null): Reading<ProviderShares> | null {
  return useReadingQuery(keys.rangeShares(wallet), () => getRangeSharesOf(wallet as Address), { ...PRODUCT, pollMs: MARKETS_POLL_MS, enabled: wallet !== null });
}

/** The maker vault's sheet and tunables; `null` inside the reading where no vault is deployed. */
export function useMakerVault(): Reading<MakerVaultState | null> | null {
  return useReadingQuery(keys.makerVault(), getMakerVaultState, { ...PRODUCT, pollMs: MARKETS_POLL_MS });
}

/** The Windows the maker vault is quoting or holding; empty (never an error) without a vault. */
export function useMakerWindows(): Reading<MakerWindowView[]> | null {
  return useReadingQuery(keys.makerWindows(), listMakerOpenWindows, { ...PRODUCT, pollMs: MARKETS_POLL_MS });
}

/** The maker vault's Windows, newest first, settled ones with their result. */
export function useMakerHistory(limit = 20): Reading<MakerWindowView[]> | null {
  return useReadingQuery(keys.makerHistory(limit), () => listMakerHistory(limit), { ...PRODUCT, pollMs: MARKETS_POLL_MS });
}

/** One wallet's maker vault shares and their worth; zeros without a vault. */
export function useMakerShares(wallet: Address | null): Reading<ProviderShares> | null {
  return useReadingQuery(keys.makerShares(wallet), () => getMakerSharesOf(wallet as Address), { ...PRODUCT, pollMs: MARKETS_POLL_MS, enabled: wallet !== null });
}

/** What the vault holds for the wallet on one Window; zeros without a vault. */
export function useVaultHoldings(wallet: Address | null, onchain: OnchainSnapshot | null): Reading<VaultHoldings> | null {
  return useReadingQuery(keys.vaultHoldings(wallet, onchain?.marketId ?? null), () => getVaultHoldings(wallet as Address, onchain as OnchainSnapshot), {
    ...PRODUCT,
    pollMs: MARKETS_POLL_MS,
    enabled: wallet !== null && onchain !== null,
  });
}

/** The leverage reserve's sheet; null (never an error) where none is deployed. */
export function useLeverageReserve(enabled = true): Reading<LeverageReserveState | null> | null {
  return useReadingQuery(keys.leverageReserve(), getLeverageReserveState, { ...PRODUCT, pollMs: MARKETS_POLL_MS, enabled });
}

/** One wallet's boost reserve shares and their worth; zeros without a reserve. */
export function useLeverageShares(wallet: Address | null): Reading<ProviderShares> | null {
  return useReadingQuery(keys.leverageShares(wallet), () => getLeverageSharesOf(wallet as Address), { ...PRODUCT, pollMs: MARKETS_POLL_MS, enabled: wallet !== null });
}

/** One wallet's boosts, live first; empty without a reserve. */
export function useMyLeveragePositions(wallet: Address | null): Reading<LeveragePosition[]> | null {
  return useReadingQuery(keys.leveragePositions(wallet), () => listLeveragePositionsOf(wallet as Address), { ...PRODUCT, pollMs: MARKETS_POLL_MS, enabled: wallet !== null });
}

/** A live boost's mark off the book, against its knock-out line. */
export function useLeverageMark(positionId: bigint | null): Reading<LeverageMark> | null {
  return useReadingQuery(keys.leverageMark(positionId === null ? null : positionId.toString()), () => getLeverageMark(positionId as bigint), { pollMs: ONCHAIN_POLL_MS, enabled: positionId !== null });
}

/** The private desk's sheet and pinned signer; null (never an error) where none is deployed. */
export function usePrivateDesk(): Reading<PrivateDeskState | null> | null {
  return useReadingQuery(keys.privateDesk(), getPrivateDeskState, { ...PRODUCT, pollMs: MARKETS_POLL_MS });
}

/** One wallet's private balance and the desk's allowance on it; zeros without a desk. */
export function usePrivateBudget(wallet: Address | null): Reading<PrivateBudget> | null {
  return useReadingQuery(keys.privateBudget(wallet), () => getPrivateBudget(wallet as Address), { ...PRODUCT, pollMs: MARKETS_POLL_MS, enabled: wallet !== null });
}

/** One slot as the contract records it — no owner on it. */
export function usePrivateSlot(slotId: Hash32 | null): Reading<PrivateSlot | null> | null {
  return useReadingQuery(keys.privateSlot(slotId), () => getPrivateSlot(slotId as Hash32), { ...PRODUCT, pollMs: MARKETS_POLL_MS, enabled: slotId !== null });
}

/** The duel arena's tunables, priced tiers and pause switch; null (never an error) where none is deployed. */
export function useArenaState(): Reading<ArenaState | null> | null {
  return useReadingQuery(keys.arenaState(), getArenaState, { ...PRODUCT, pollMs: MARKETS_POLL_MS });
}

/**
 * One match as the chain holds it — the record, the deck, both seats' picks and the running PnL.
 *
 * Polled on the on-chain cadence rather than the market one: this is what a settling deck fills in
 * card by card, and it is also the reading a room's own deltas are checked against.
 */
export function useArenaMatch(matchId: Hash32 | null): Reading<ArenaMatchView | null> | null {
  return useReadingQuery(keys.arenaMatch(matchId), () => getArenaMatch(matchId as Hash32), { ...PRODUCT, pollMs: ONCHAIN_POLL_MS, enabled: matchId !== null });
}

/** What the arena owes one wallet — card payouts and pot alike, waiting on a pull. Zero without an arena. */
export function useArenaCredit(wallet: Address | null): Reading<bigint> | null {
  return useReadingQuery(keys.arenaCredit(wallet), () => getArenaCredit(wallet as Address), { ...PRODUCT, pollMs: MARKETS_POLL_MS, enabled: wallet !== null });
}

/**
 * What a stake buys on one side of one card right now — the arena's own `sizeForStake`, polled on the
 * market cadence. A revert is an answer, not an outage: the walk refusing (too thin, too late, not
 * trading) comes back as the error arm, which is exactly the "locked" a card face shows on that side.
 */
export function useArenaQuote(marketId: MarketId | null, pick: Pick, stakeBase: bigint | null): Reading<ArenaQuote | null> | null {
  const signature = `${marketId ?? ""}:${pick}:${stakeBase?.toString() ?? ""}`;
  return useReadingQuery(keys.arenaQuote(signature), () => quoteArenaPick(marketId as MarketId, pick, stakeBase as bigint), {
    pollMs: MARKETS_POLL_MS,
    enabled: marketId !== null && stakeBase !== null && stakeBase > 0n,
  });
}
