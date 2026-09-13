import type { ClaimableRow, MarketId, OutcomeIdx } from "@masayume/core/types";
import type { ClaimItem, ClaimRun } from "./types";

export const IDLE_RUN: ClaimRun = { status: "idle", items: [], diagnosis: null, gasShort: false, finishedAtMs: null };

export function itemKey(marketId: MarketId, outcomeIdx: OutcomeIdx): string {
  return `${marketId}:${outcomeIdx}`;
}

/** Flattens rows into the per-leg items the wallet will sign for, in the order they are shown. */
export function itemsFromRows(rows: readonly ClaimableRow[]): ClaimItem[] {
  return rows.flatMap((row) =>
    row.legs.map((leg) => ({
      key: itemKey(row.marketId, leg.outcomeIdx),
      marketId: row.marketId,
      marketAddress: row.marketAddress,
      kind: row.kind,
      asset: row.asset,
      intervalSec: row.intervalSec,
      outcomeIdx: leg.outcomeIdx,
      amountRaw: leg.amountRaw,
      payoutBase: leg.payoutBase,
      decimals: row.decimals,
      status: "pending" as const,
      txHash: null,
      diagnosis: null,
    })),
  );
}

export function confirmedItems(items: readonly ClaimItem[]): ClaimItem[] {
  return items.filter((item) => item.status === "confirmed");
}

export function paidTotal(items: readonly ClaimItem[]): bigint {
  return confirmedItems(items).reduce((sum, item) => sum + item.payoutBase, 0n);
}

export interface ClaimProgressCounts {
  total: number;
  confirmed: number;
  /** 1-based position of the item currently being signed; null when nothing is in flight. */
  current: number | null;
}

export function progressCounts(run: ClaimRun): ClaimProgressCounts {
  const claimingAt = run.items.findIndex((item) => item.status === "claiming");
  return {
    total: run.items.length,
    confirmed: confirmedItems(run.items).length,
    current: claimingAt === -1 ? null : claimingAt + 1,
  };
}

export function itemsByMarket(items: readonly ClaimItem[]): Map<MarketId, ClaimItem[]> {
  const grouped = new Map<MarketId, ClaimItem[]>();
  for (const item of items) grouped.set(item.marketId, [...(grouped.get(item.marketId) ?? []), item]);
  return grouped;
}

export function distinctMarketIds(items: readonly ClaimItem[]): MarketId[] {
  return [...new Set(items.map((item) => item.marketId))];
}
