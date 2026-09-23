"use client";

import { diagnosis, err, ok, type Reading } from "@agari/core";
import type { TickerSymbol } from "@agari/core/market";
import { useReadingQuery } from "@agari/markets/react";
import { indexConfigured, indexGet } from "@/lib/index-read";
import { BUILT_ON_FROM_SEC, builtOnTally, PROOF_SOURCE, type BuiltOnTally, type MixRow } from "./built-on";

/** The mix moves by one Window a close; five minutes of freshness is honest for a count on a story page. */
const STALE_MS = 5 * 60_000;
const GC_MS = 30 * 60_000;
/** Newest terminal Windows read per name when looking for the latest one a source closed (a token lane interleaves). */
const PROOF_SCAN = 12;
/** Names asked per source for that Window, most-listed first. */
const PROOF_NAMES = 3;

export interface BuiltOn {
  tally: BuiltOnTally;
  /** The newest Window each source closed, for its "print proof" link; null when none was found. */
  proof: { prestocks: string | null; pyth: string | null };
}

interface ProofRow {
  market: string;
  expiry_sec: string;
  prints?: Record<string, { source: number } | undefined> | null;
}

/** The newest resolved Window among `names` whose closing print came from `source`. */
async function latestClosedOn(names: readonly TickerSymbol[], source: number): Promise<string | null> {
  const lists = await Promise.all(names.slice(0, PROOF_NAMES).map((s) => indexGet<ProofRow>(`markets?symbol=${s}&state=resolved&limit=${PROOF_SCAN}`).catch(() => [])));
  const hits = lists.flat().filter((row) => row.prints?.["1"]?.source === source);
  hits.sort((a, b) => Number(b.expiry_sec) - Number(a.expiry_sec));
  return hits[0]?.market ?? null;
}

async function readBuiltOn(): Promise<Reading<BuiltOn>> {
  if (!indexConfigured()) return err(diagnosis("indexer-down", "no indexer configured"));
  const rows = await indexGet<MixRow>(`status/prints?from=${BUILT_ON_FROM_SEC}`);
  const tally = builtOnTally(rows);
  const [prestocks, pyth] = await Promise.all([
    latestClosedOn([...tally.prestocks.names, ...tally.prestocks.baskets], PROOF_SOURCE.prestocks),
    latestClosedOn(tally.pyth.names, PROOF_SOURCE.pyth),
  ]);
  return ok({ tally, proof: { prestocks, pyth } }, Date.now());
}

/** The landing's "Built on" figures: one print-mix read and a few one-page Window reads, cached, never polled. */
export function useBuiltOn(): Reading<BuiltOn> | null {
  return useReadingQuery(["agari", "landing", "built-on", BUILT_ON_FROM_SEC], readBuiltOn, { staleTimeMs: STALE_MS, gcTimeMs: GC_MS, needs: [] });
}
