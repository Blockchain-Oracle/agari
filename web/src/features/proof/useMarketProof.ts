"use client";

import { isOk, type Reading } from "@agari/core/schemas";
import type { MarketId } from "@agari/core/types";
import { getMarketProof, type PrintProof } from "@agari/markets";
import { useReadingQuery } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/** proof-analytics.md §3: one key per Window; 3 s while a replay posts; never refetched once every Pyth print is proven. */
export const proofKey = (marketId: MarketId | null) => ["agari", "markets", "proof", marketId] as const;
const POSTING_POLL_MS = 3_000;
const UNPROVEN_STALE_MS = 60_000;

const isPosting = (prints: readonly PrintProof[]) => prints.some((p) => p.replay?.state === "posting");

/** A closed Window whose Pyth prints are all verified (or verified, then closed) no longer changes. */
export function provenForGood(prints: readonly PrintProof[]): boolean {
  return prints.some((p) => p.which === 1) && prints.filter((p) => p.source === "pyth").every((p) => p.replay?.state === "verified" || p.replay?.state === "closed");
}

export function useMarketProof(marketId: MarketId | null): { reading: Reading<PrintProof[]> | null; refresh: () => void } {
  const client = useQueryClient();
  const cached = client.getQueryData<Reading<PrintProof[]>>(proofKey(marketId));
  const reading = useReadingQuery(proofKey(marketId), () => getMarketProof(marketId as MarketId), {
    enabled: marketId !== null,
    needs: [],
    pollMs: (r) => (r && isOk(r) && isPosting(r.value) ? POSTING_POLL_MS : false),
    staleTimeMs: cached && isOk(cached) && provenForGood(cached.value) ? Number.POSITIVE_INFINITY : UNPROVEN_STALE_MS,
  });
  const refresh = useCallback(() => void client.invalidateQueries({ queryKey: proofKey(marketId) }), [client, marketId]);
  return { reading, refresh };
}
