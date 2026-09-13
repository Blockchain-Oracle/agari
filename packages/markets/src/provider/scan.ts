import { type LedgerSetAction } from "@masayume/core/projection";
import type { Address, Bytes32, MarketId } from "@masayume/core/types";
import type { BinaryMarket, FillRow } from "@somnia-chain/markets-sdk";
import { toSetAction } from "../mappers/fill";
import { getClient } from "../runtime/read-runtime";
import { settlementFeeBps } from "./fees";
import type { Unwrap } from "./reading";

/**
 * The venue-wide scan the board and the traction page share: every Window that expired inside a
 * window of time, the fill tape of every pool that carried one, and each participant's router
 * actions. Paging caps are reported as `complete: false`, never papered over.
 */
export interface ScanScope {
  venueId: Bytes32;
  windowStartMs: number;
  windowEndMs: number;
  /** Fetch fills and actions from here; must precede the window by the longest cadence. */
  lookbackSec: number;
}

const FILL_PAGE = 1_000;
const FILL_MAX_PAGES = 5;
const PAST_PAGE = 100;
const PAST_MAX_PAGES = 20;
const ROUTER_PAGE = 1_000;
const ROUTER_MAX_PAGES = 3;

const feeByMarket = new Map<MarketId, number>();

/** Keep the full lookback: an older expiry can resolve inside the ranking window. */
export async function marketsInScope(scope: ScanScope): Promise<{ markets: BinaryMarket[]; pools: Set<string>; complete: boolean }> {
  const client = getClient();
  const nowSec = Math.floor(scope.windowEndMs / 1000);
  const markets: BinaryMarket[] = [];
  const pools = new Set<string>();
  let complete = false;
  for (let page = 0; page < PAST_MAX_PAGES; page += 1) {
    const rows = await client.listPastBinaryMarkets({ venueId: scope.venueId, limit: PAST_PAGE, offset: page * PAST_PAGE, nowSec });
    const included = rows.filter((row) => {
      const resolvedAtMs = Number(row.resolvedAtTimestamp) * 1000;
      const closesInWindow = Number(row.expiry) * 1000 >= scope.windowStartMs
        || (resolvedAtMs >= scope.windowStartMs && resolvedAtMs < scope.windowEndMs);
      return closesInWindow && Number(row.tradingStart ?? row.expiry) >= scope.lookbackSec;
    });
    for (const row of included) pools.add(row.poolAddress.toLowerCase());
    markets.push(...included);
    const oldest = rows.at(-1);
    if (rows.length < PAST_PAGE || (oldest && Number(oldest.expiry) < scope.lookbackSec)) {
      complete = true;
      break;
    }
  }
  return { markets, pools, complete };
}

export async function fillsSince(pool: string, sinceSec: number): Promise<{ rows: FillRow[]; complete: boolean }> {
  const rows: FillRow[] = [];
  for (let page = 0; page < FILL_MAX_PAGES; page += 1) {
    const batch = await getClient().getFills(pool, { since: sinceSec, limit: FILL_PAGE, offset: page * FILL_PAGE });
    rows.push(...batch);
    if (batch.length < FILL_PAGE) return { rows, complete: true };
  }
  return { rows, complete: false };
}

/** Router actions are per account; page newest-first until the tail predates the lookback. */
export async function setActionsFor(wallet: Address, sinceSec: number, inScope: Set<MarketId>): Promise<{ actions: LedgerSetAction[]; complete: boolean }> {
  const actions: LedgerSetAction[] = [];
  for (let page = 0; page < ROUTER_MAX_PAGES; page += 1) {
    const batch = await getClient().getRouterActions(wallet, { limit: ROUTER_PAGE, offset: page * ROUTER_PAGE });
    for (const record of batch) {
      const action = toSetAction(record);
      if (action && inScope.has(action.marketId)) actions.push(action);
    }
    const oldest = batch.at(-1);
    if (batch.length < ROUTER_PAGE || (oldest && Number(oldest.timestamp) < sinceSec)) return { actions, complete: true };
  }
  return { actions, complete: false };
}

export async function feeFor(inner: Unwrap, marketId: MarketId): Promise<number> {
  const cached = feeByMarket.get(marketId);
  if (cached !== undefined) return cached;
  const bps = inner(await settlementFeeBps(marketId));
  feeByMarket.set(marketId, bps);
  return bps;
}

export function participants(fills: readonly FillRow[]): Address[] {
  const wallets = new Set<string>();
  for (const fill of fills) {
    if (fill.maker) wallets.add(fill.maker.toLowerCase());
    const taker = fill.takerOrder?.owner ?? fill.taker;
    if (taker) wallets.add(taker.toLowerCase());
  }
  return [...wallets] as Address[];
}
