import {
  buildLedgers,
  ledgerHasActivity,
  roundSettledAtMs,
  settleRound,
  type LedgerFill,
  type LedgerSetAction,
  type MarketLedger,
  type RoundMarket,
  type SettledRound,
  type WalletHistory,
} from "@masayume/core/projection";
import type { Reading } from "@masayume/core/schemas";
import { toMarketId, type Address, type Holdings, type MarketId } from "@masayume/core/types";
import type { BinaryMarket } from "@somnia-chain/markets-sdk";
import { getCollateral } from "../collateral";
import { toLedgerFill, toSetAction } from "../mappers/fill";
import { toEventMarket } from "../mappers/market";
import { bigintOf } from "../mappers/scalars";
import { getClient } from "../runtime/read-runtime";
import { settlementFeeBps } from "./fees";
import { SETTLED_STATUSES } from "./markets";
import { resolveOutcomeToken } from "./outcome-token";
import { withReading, type Unwrap } from "./reading";
import { listVaultTallies, tallyToLedger, vaultRound } from "../vault/history";

/** The indexer's page ceiling; five pages is 5,000 fills, past which the reading says it is a prefix. */
const PAGE = 1_000;
const MAX_PAGES = 5;
const CONCURRENCY = 8;

/** A finalized row can never change again, so it is read once per process; everything else is re-read. */
const finalizedRows = new Map<MarketId, BinaryMarket>();
/** Fees are frozen into a market at creation (canon #15 is about reading them from chain, not re-reading them). */
const feeByMarket = new Map<MarketId, number>();

async function pageAll<T>(fetchPage: (offset: number) => Promise<T[]>): Promise<{ rows: T[]; complete: boolean }> {
  const rows: T[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const batch = await fetchPage(page * PAGE);
    rows.push(...batch);
    if (batch.length < PAGE) return { rows, complete: true };
  }
  return { rows, complete: false };
}

/** Bounded fan-out, so a wallet with hundreds of Windows does not open hundreds of sockets at once. */
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

async function marketRow(marketId: MarketId): Promise<BinaryMarket | null> {
  const cached = finalizedRows.get(marketId);
  if (cached) return cached;
  const row = await getClient().getBinaryMarket(marketId);
  if (row?.status === "Finalized") finalizedRows.set(marketId, row);
  return row;
}

export function toRoundMarket(row: BinaryMarket): RoundMarket {
  const market = toEventMarket(row, null);
  return {
    marketId: market.marketId,
    asset: market.asset,
    intervalSec: market.intervalSec,
    expirySec: market.expirySec,
    decimals: market.decimals,
    settled: SETTLED_STATUSES.has(market.status),
    voided: market.voided,
    winningOutcome: market.winningOutcome,
    resolvedAtMs: market.resolvedAtMs,
  };
}

async function feeFor(inner: Unwrap, marketId: MarketId): Promise<number> {
  const cached = feeByMarket.get(marketId);
  if (cached !== undefined) return cached;
  const bps = inner(await settlementFeeBps(marketId));
  feeByMarket.set(marketId, bps);
  return bps;
}

/**
 * Head-fresh balances for every settled market in one batched read — the witness for whether a
 * payout was collected. A failed read yields null for all of them: the rows then say "unknown",
 * never "paid".
 */
async function liveHoldings(inner: Unwrap, wallet: Address, rows: readonly BinaryMarket[]): Promise<Map<MarketId, Holdings> | null> {
  const first = rows[0];
  if (!first) return new Map();
  try {
    const token = await resolveOutcomeToken(inner, toMarketId(first.marketId));
    const ids = rows.flatMap((row) => [bigintOf(row.yesTokenId), bigintOf(row.noTokenId)]);
    if (ids.some((id) => id === null)) return null;
    const balances = await getClient().getBalances(
      ids.map((id) => ({ token, id: id as bigint })),
      wallet,
    );
    return new Map(rows.map((row, i) => [toMarketId(row.marketId), { upRaw: balances[i * 2] ?? 0n, downRaw: balances[i * 2 + 1] ?? 0n }]));
  } catch {
    return null;
  }
}

/** Ledgers are built per collateral decimals, so a venue with a different unit could never mix into another's sums. */
function ledgersByDecimals(fills: readonly LedgerFill[], actions: readonly LedgerSetAction[], decimalsOf: Map<MarketId, number>, fallback: number): Map<MarketId, MarketLedger> {
  const groups = new Map<number, { fills: LedgerFill[]; actions: LedgerSetAction[] }>();
  const group = (marketId: MarketId) => {
    const decimals = decimalsOf.get(marketId) ?? fallback;
    const entry = groups.get(decimals) ?? { fills: [], actions: [] };
    groups.set(decimals, entry);
    return entry;
  };
  for (const fill of fills) group(fill.marketId).fills.push(fill);
  for (const action of actions) group(action.marketId).actions.push(action);
  const merged = new Map<MarketId, MarketLedger>();
  for (const [decimals, entry] of groups) for (const [id, ledger] of buildLedgers(entry.fills, entry.actions, decimals)) merged.set(id, ledger);
  return merged;
}

/**
 * The wallet's complete settled history: every fill and every complete-set action it ever made on
 * the venue, replayed into one ledger per Window, settled by the chain's own rule. Paged to the
 * indexer's ceiling; a wallet past the cap gets a reading that says so rather than a silent prefix.
 */
export async function listWalletHistory(wallet: Address): Promise<Reading<WalletHistory>> {
  return withReading(`history:${wallet}`, async (inner) => {
    const client = getClient();
    const fallbackDecimals = getCollateral().decimals;
    const [fillPages, actionPages] = await Promise.all([
      pageAll((offset) => client.getUserFills(wallet, { limit: PAGE, offset })),
      pageAll((offset) => client.getRouterActions(wallet, { limit: PAGE, offset })),
    ]);
    const fills = fillPages.rows.map((row) => toLedgerFill(wallet, row));
    const attributed = fills.filter((fill): fill is LedgerFill => fill !== null);
    const actions = actionPages.rows.map(toSetAction).filter((action): action is LedgerSetAction => action !== null);

    const ids = [...new Set([...attributed.map((fill) => fill.marketId), ...actions.map((action) => action.marketId)])];
    const rows = await mapPool(ids, CONCURRENCY, marketRow);
    const rowById = new Map<MarketId, BinaryMarket>();
    rows.forEach((row, i) => {
      if (row) rowById.set(ids[i] as MarketId, row);
    });
    const decimalsOf = new Map([...rowById].map(([id, row]) => [id, row.quoteDecimals]));
    const ledgers = ledgersByDecimals(attributed, actions, decimalsOf, fallbackDecimals);

    const settledRows = [...rowById.values()].filter((row) => SETTLED_STATUSES.has(row.status) && ledgerHasActivity(ledgers.get(toMarketId(row.marketId)) as MarketLedger));
    const [fees, holdings] = await Promise.all([
      mapPool(settledRows, CONCURRENCY, (row) => feeFor(inner, toMarketId(row.marketId))),
      liveHoldings(inner, wallet, settledRows),
    ]);

    const rounds: SettledRound[] = [];
    settledRows.forEach((row, i) => {
      const marketId = toMarketId(row.marketId);
      const round = settleRound({ ledger: ledgers.get(marketId) as MarketLedger, market: toRoundMarket(row), feeBps: fees[i] as number, liveHoldings: holdings?.get(marketId) ?? null });
      if (round) rounds.push(round);
    });
    let openCount = 0;
    for (const [id, ledger] of ledgers) {
      const row = rowById.get(id);
      if (row && !SETTLED_STATUSES.has(row.status) && ledger.heldUpRaw + ledger.heldDownRaw > 0n) openCount += 1;
    }

    // The vault's seat (AD-1's second event source): what the vault traded for this wallet, from its own tally.
    const vault = await listVaultTallies(wallet);
    const vaultRows = await mapPool(vault.tallies, CONCURRENCY, async (t) => rowById.get(t.marketId) ?? (await marketRow(t.marketId)));
    for (const [i, tally] of vault.tallies.entries()) {
      const row = vaultRows[i];
      if (!row) continue;
      if (SETTLED_STATUSES.has(row.status)) {
        const round = vaultRound(tally, toRoundMarket(row), await feeFor(inner, tally.marketId));
        if (round) rounds.push(round);
      } else {
        const ledger = tallyToLedger(tally);
        if (ledger.heldUpRaw + ledger.heldDownRaw > 0n) openCount += 1;
      }
    }
    rounds.sort((a, b) => roundSettledAtMs(b) - roundSettledAtMs(a));

    return {
      rounds,
      openCount,
      fillCount: fillPages.rows.length + vault.tallies.reduce((sum, t) => sum + t.fillCount, 0),
      complete: fillPages.complete && actionPages.complete && attributed.length === fills.length && vault.complete,
      decimals: fallbackDecimals,
    };
  });
}
