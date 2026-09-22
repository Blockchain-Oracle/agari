import { OUTCOME_TO_SIDE, type ClaimableRow, type MarketId } from "@agari/core/types";
import { CLAIM } from "@/lib/copy";
import type { ClaimItem, ClaimRun } from "./types";

export const IDLE_RUN: ClaimRun = { status: "idle", items: [], diagnosis: null, gasShort: false, finishedAtMs: null };

export function itemKey(marketId: MarketId): string {
  return marketId;
}

/** One item per Window, in the order the rows are shown: the wallet signs once for all of a Window's legs. */
export function itemsFromRows(rows: readonly ClaimableRow[]): ClaimItem[] {
  return rows
    .filter((row) => row.legs.length > 0)
    .map((row) => ({
      key: itemKey(row.marketId),
      marketId: row.marketId,
      marketAddress: row.marketAddress,
      kind: row.kind,
      asset: row.asset,
      intervalSec: row.intervalSec,
      legs: row.legs,
      outcomeIdx: row.legs[0]?.outcomeIdx ?? 0,
      amountRaw: row.legs[0]?.amountRaw ?? 0n,
      payoutBase: row.legs.reduce((sum, leg) => sum + leg.payoutBase, 0n),
      decimals: row.decimals,
      status: "pending" as const,
      txHash: null,
      diagnosis: null,
    }));
}

/** Every item whose money reached the wallet: this run's own redeems and the seats the crank had paid already. */
export function confirmedItems(items: readonly ClaimItem[]): ClaimItem[] {
  return items.filter((item) => item.status === "confirmed" || item.status === "paid");
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

/** "UP leg", or "UP leg + DOWN leg" for a void Window redeemed in one signature. */
export function legWords(item: Pick<ClaimItem, "legs">): string {
  return item.legs.map((leg) => CLAIM.leg[OUTCOME_TO_SIDE[leg.outcomeIdx]]).join(" + ");
}
