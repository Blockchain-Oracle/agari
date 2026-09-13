import { buildLedgers, ledgerHasActivity, rankTraders, roundSettledAtMs, settleRound, type LedgerFill, type MarketLedger, type SettledRound, type TraderRanking } from "@masayume/core/projection";
import type { Reading } from "@masayume/core/schemas";
import { toMarketId, type Address, type MarketId } from "@masayume/core/types";
import type { BinaryMarket } from "@somnia-chain/markets-sdk";
import { loadCollateral } from "../collateral";
import { toLedgerFill } from "../mappers/fill";
import { mapPool, toRoundMarket } from "./history";
import { SETTLED_STATUSES } from "./markets";
import { withReading } from "./reading";
import { feeFor, fillsSince, marketsInScope, participants, setActionsFor, type ScanScope } from "./scan";
import { deriveTraction, type VenueTraction } from "./traction";

/**
 * The venue-wide board: every wallet's rounds that closed inside a window, ranked by realised
 * result — the same replay `/portfolio` uses, run over the fill tape of every pool.
 *
 * Fills are fetched from a day further back than the window so every Window that EXPIRED in the
 * window has its whole trading life in hand (no cadence here is longer than a day); a Window that
 * started earlier than that is left out rather than scored on a partial ledger.
 */
export interface VenueBoard {
  rankings: TraderRanking[];
  windowStartMs: number;
  windowEndMs: number;
  rankedTraders: number;
  totalWallets: number;
  closedCalls: number;
  /** False when a paging cap cut a scan short — the board then covers a prefix of the day and says so. */
  complete: boolean;
  decimals: number;
  symbol: string;
  /** Traction over the same window, off the same tape — one scan serves both surfaces. */
  traction: VenueTraction;
}

export interface BoardScope extends ScanScope {
  top: number;
}

const CONCURRENCY = 8;

export async function readVenueBoard(scope: BoardScope): Promise<Reading<VenueBoard>> {
  return withReading(`board:${scope.venueId}:${scope.windowEndMs}`, async (inner) => {
    const [collateralReading, scanned] = await Promise.all([loadCollateral(), marketsInScope(scope)]);
    const collateral = inner(collateralReading);
    const { markets, pools, complete: marketsComplete } = scanned;
    const rowById = new Map<MarketId, BinaryMarket>(markets.map((row) => [toMarketId(row.marketId), row]));
    const inScope = new Set(rowById.keys());

    const tapes = await mapPool([...pools], CONCURRENCY, (pool) => fillsSince(pool, scope.lookbackSec));
    const fills = tapes.flatMap((tape) => tape.rows).filter((fill) => inScope.has(toMarketId(fill.market)));
    let complete = marketsComplete && tapes.every((tape) => tape.complete);

    const wallets = await mapPool(participants(fills), CONCURRENCY, async (wallet) => {
      const own = fills.map((fill) => toLedgerFill(wallet, fill)).filter((fill): fill is LedgerFill => fill !== null);
      const { actions, complete: actionsComplete } = await setActionsFor(wallet, scope.lookbackSec, inScope);
      complete &&= actionsComplete;
      return { wallet, ledgers: buildLedgers(own, actions, collateral.decimals) };
    });
    // Fees matter only for ledgers we actually settle, including complete-set actions without fills.
    const activeIds = new Set(wallets.flatMap(({ ledgers }) => [...ledgers].filter(([, ledger]) => ledgerHasActivity(ledger)).map(([id]) => id)));
    const settledIds = [...activeIds].filter((id) => {
      const row = rowById.get(id);
      if (!row || !SETTLED_STATUSES.has(row.status)) return false;
      const market = toRoundMarket(row);
      const atMs = roundSettledAtMs({ settledAtMs: market.resolvedAtMs, expirySec: market.expirySec });
      return atMs >= scope.windowStartMs && atMs < scope.windowEndMs;
    });
    const fees = new Map(await mapPool(settledIds, CONCURRENCY, async (id) => [id, await feeFor(inner, id)] as const));

    const byWallet = new Map<Address, SettledRound[]>();
    for (const { wallet, ledgers } of wallets) {
      const rounds: SettledRound[] = [];
      for (const [id, ledger] of ledgers) {
        const row = rowById.get(id);
        const feeBps = fees.get(id);
        if (!row || feeBps === undefined || !ledgerHasActivity(ledger as MarketLedger)) continue;
        // No live balance on a venue-wide scan: the board ranks results, it never claims a payout was collected.
        const round = settleRound({ ledger, market: toRoundMarket(row), feeBps, liveHoldings: null });
        if (round) rounds.push(round);
      }
      if (rounds.length > 0) byWallet.set(wallet, rounds);
    }

    const { rankings, closedCalls, totalWallets } = rankTraders(byWallet, scope);
    return {
      rankings: rankings.slice(0, scope.top),
      windowStartMs: scope.windowStartMs,
      windowEndMs: scope.windowEndMs,
      rankedTraders: rankings.length,
      totalWallets,
      closedCalls,
      complete,
      decimals: collateral.decimals,
      symbol: collateral.symbol,
      traction: deriveTraction(fills, rowById, scope, collateral.decimals),
    };
  });
}
