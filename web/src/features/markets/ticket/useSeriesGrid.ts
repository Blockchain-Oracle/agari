"use client";

import { ok, type Reading } from "@agari/core/schemas";
import type { Address } from "@agari/core/types";
import { marketsProvider } from "@agari/markets";
import { keys, useReadingQuery } from "@agari/markets/react";
import { readSeries, type SeriesFacts } from "@agari/markets/runtime";

/** Series facts are fixed at registration; a read holds for the session. */
const SERIES_STALE_MS = 6 * 3_600_000;

/**
 * The Series grid a scheduled call is sized on (D-088): lot and tick bases, the cash unit, `min_lots` and the seat
 * bond — the same read the rest lane makes before it signs, so the ticket's escrow is the chain's escrow. Null until
 * read; the ticket says "reading the grid" rather than sizing on a guess.
 */
export function useSeriesGrid(series: Address | null): SeriesFacts | null {
  const reading = useReadingQuery<SeriesFacts>(
    keys.series(series),
    async (): Promise<Reading<SeriesFacts>> => ok(await readSeries(series as Address), marketsProvider.nowMs()),
    { enabled: series !== null, staleTimeMs: SERIES_STALE_MS },
  );
  return reading?.ok ? reading.value : null;
}
