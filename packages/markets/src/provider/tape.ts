/**
 * The venue board and traction (S5, from the indexer's venue-wide tape); a wallet's own fills live in `history.ts`.
 * The shapes are Masayume's, so the surfaces that render them don't change.
 */
import type { LedgerFill, RoundMarket, TraderRanking } from "@agari/core/projection";
import type { Reading } from "@agari/core/schemas";
import type { TickerSymbol } from "@agari/core/market";
import type { Address, EventMarket, MarketId } from "@agari/core/types";
import { notDeployedReading } from "../stub/not-deployed";

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
}

/** The venue-wide board is S5's (it needs a tape scan the S4 index API doesn't serve). */
export async function readVenueBoard(_scope: BoardScope): Promise<Reading<VenueBoard>> {
  return notDeployedReading("the venue board arrives in S5");
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
