/**
 * The venue board and traction (S5, from the indexer's venue-wide tape); a wallet's own fills live in `history.ts`.
 * The shapes are Masayume's, so the surfaces that render them don't change; `byTicker` is additive (proof-analytics.md §2.3).
 */
import { buildLedgers, ledgerHasActivity, rankTraders, settleRound, type LedgerFill, type MarketLedger, type RoundMarket, type SettledRound, type TraderRanking } from "@agari/core/projection";
import type { Reading } from "@agari/core/schemas";
import { TICKER_SYMBOLS, type TickerSymbol } from "@agari/core/market";
import type { Address, EventMarket, MarketId } from "@agari/core/types";
import { loadCollateral } from "../collateral";
import { sec, type MarketRow } from "./index-api";
import { withReading } from "./reading";
import { outcomeOf } from "./rows";
import { scanTape, walletTapes } from "./tape-scan";
import { deriveTraction } from "./tape-traction";

/** A taker's buy is a call; a taker's sell is a cash-out. Traction counts attributed fills only. */
export interface TractionCall {
  /** `<txHash>:<wallet>`: one taker order lands in one transaction. */
  id: string;
  wallet: Address;
  kind: "call" | "cash-out";
  side: "up" | "down";
  asset: TickerSymbol;
  marketId: MarketId;
  stakeBase: bigint;
  txHash: LedgerFill["txHash"];
  atMs: number;
}

export interface TractionPoint {
  atMs: number;
  cumulative: number;
}

export interface VenueTraction {
  wallets: number;
  calls: number;
  cashOuts: number;
  stakedBase: bigint;
  unattributed: number;
  windows: number;
  settledWindows: number;
  curve: TractionPoint[];
  recent: TractionCall[];
}

export interface ScanScope {
  venueId: Address;
  windowStartMs: number;
  windowEndMs: number;
  /** Fetch fills from here; must precede the window by the longest cadence. */
  lookbackSec: number;
}

export interface BoardScope extends ScanScope {
  top: number;
  /** Venue operator wallets (seed maker, settler crank), left off the rankings and traction (Q-S5-2). */
  operators?: readonly string[];
}

/** One ticker's board, ranked from the same rounds as the venue's. */
export interface BoardSlice {
  rankings: TraderRanking[];
  rankedTraders: number;
  totalWallets: number;
  closedCalls: number;
  /** Stake of the ranked rows served (the top `scope.top`). */
  totalVolumeBase: bigint;
}

/** Every wallet's rounds that closed inside a window, ranked by realised result, plus traction off the same tape. */
export interface VenueBoard {
  rankings: TraderRanking[];
  windowStartMs: number;
  windowEndMs: number;
  rankedTraders: number;
  totalWallets: number;
  closedCalls: number;
  /** False when a paging cap cut a scan short. */
  complete: boolean;
  decimals: number;
  symbol: string;
  traction: VenueTraction;
  byTicker: Partial<Record<TickerSymbol, BoardSlice>>;
}

function roundMarketOf(row: MarketRow, decimals: number): RoundMarket {
  return {
    marketId: row.market as MarketId,
    asset: row.symbol ?? "",
    intervalSec: row.cadence_sec ?? 0,
    expirySec: sec(row.expiry_sec),
    decimals,
    settled: row.state !== "open",
    voided: row.state === "voided",
    winningOutcome: outcomeOf(row.winner),
    resolvedAtMs: row.resolved_ts_sec === null ? null : sec(row.resolved_ts_sec) * 1000,
  };
}

function sliceOf(byWallet: ReadonlyMap<Address, readonly SettledRound[]>, scope: BoardScope): BoardSlice {
  const { rankings, closedCalls, totalWallets } = rankTraders(byWallet, scope);
  const top = rankings.slice(0, scope.top);
  return { rankings: top, rankedTraders: rankings.length, totalWallets, closedCalls, totalVolumeBase: top.reduce((sum, r) => sum + r.volumeBase, 0n) };
}

/**
 * Every wallet's rounds that closed inside a window, ranked by realised result: the replay `/portfolio` runs, over three
 * paged tape scans (`tape-scan.ts`). No live balance on a venue-wide scan: the board ranks results, it never claims a
 * payout was collected. Settlement carries no fee on this venue (`settle.ts`).
 */
export async function readVenueBoard(scope: BoardScope): Promise<Reading<VenueBoard>> {
  return withReading(`board:${scope.venueId}:${scope.windowEndMs}`, async (inner) => {
    const [collateralReading, scan] = await Promise.all([loadCollateral(), scanTape(scope)]);
    const collateral = inner(collateralReading);
    const operators = new Set(scope.operators ?? []);

    const byWallet = new Map<Address, SettledRound[]>();
    for (const [wallet, tape] of walletTapes(scan, operators)) {
      const rounds: SettledRound[] = [];
      for (const [id, ledger] of buildLedgers(tape.fills, tape.sets, collateral.decimals)) {
        const row = scan.rowById.get(id);
        if (!row || !ledgerHasActivity(ledger as MarketLedger)) continue;
        const round = settleRound({ ledger, market: roundMarketOf(row, collateral.decimals), feeBps: 0, liveHoldings: null });
        if (round) rounds.push(round);
      }
      if (rounds.length > 0) byWallet.set(wallet, rounds);
    }

    const venue = sliceOf(byWallet, scope);
    const byTicker: Partial<Record<TickerSymbol, BoardSlice>> = {};
    for (const symbol of TICKER_SYMBOLS) {
      const own = new Map<Address, SettledRound[]>();
      for (const [wallet, rounds] of byWallet) {
        const mine = rounds.filter((round) => round.asset === symbol);
        if (mine.length > 0) own.set(wallet, mine);
      }
      if (own.size > 0) byTicker[symbol] = sliceOf(own, scope);
    }
    return {
      rankings: venue.rankings,
      windowStartMs: scope.windowStartMs,
      windowEndMs: scope.windowEndMs,
      rankedTraders: venue.rankedTraders,
      totalWallets: venue.totalWallets,
      closedCalls: venue.closedCalls,
      complete: scan.complete,
      decimals: collateral.decimals,
      symbol: collateral.symbol,
      traction: deriveTraction(scan.fills, scan.rowById, scope, collateral.decimals, operators),
      byTicker,
    };
  });
}

/** Bounded fan-out, so a wallet with hundreds of Windows doesn't open hundreds of requests at once. */
export async function mapPool<T, R>(items: readonly T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index] as T);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

const SETTLED: ReadonlySet<EventMarket["status"]> = new Set(["Resolved", "Voided", "Finalized"]);

/** A Window as the round projection reads it. */
export function toRoundMarket(market: EventMarket): RoundMarket {
  return {
    marketId: market.marketId,
    asset: market.asset,
    intervalSec: market.intervalSec,
    expirySec: market.expirySec,
    decimals: market.decimals,
    settled: SETTLED.has(market.status),
    voided: market.voided,
    winningOutcome: market.winningOutcome,
    resolvedAtMs: market.resolvedAtMs,
  };
}
