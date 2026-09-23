"use client";

import { diagnosis, err, ok, type Reading } from "@agari/core";
import { useReadingQuery } from "@agari/markets/react";
import { indexConfigured, indexGet } from "@/lib/index-read";
import { toFeed, type FeedRow, type SettledRowWire } from "./feed";

/**
 * The newest terminal Windows across every lane in one index read (`markets?settled=1`, expiry descending, prints
 * included): about half an hour of a busy session, a day and more of the 24/7 lanes after the close.
 */
export const FEED_LIMIT = 200;
/** A Window settles at most every five minutes on a lane: a minute of freshness is honest for a list that is read, not watched. */
const STALE_MS = 60_000;
const GC_MS = 30 * 60_000;

async function readFeed(): Promise<Reading<FeedRow[]>> {
  if (!indexConfigured()) return err(diagnosis("indexer-down", "no indexer configured"));
  return ok(toFeed(await indexGet<SettledRowWire>(`markets?settled=1&limit=${FEED_LIMIT}`)), Date.now());
}

/** `/proof`'s rows: cached, never polled; a returning tab reads them again. */
export function useProofFeed(): Reading<FeedRow[]> | null {
  return useReadingQuery(["agari", "proof", "feed", FEED_LIMIT], readFeed, { staleTimeMs: STALE_MS, gcTimeMs: GC_MS, needs: [] });
}
