"use client";

import type { Reading } from "@agari/core/schemas";
import type { Address, EventMarket } from "@agari/core/types";
import { marketsProvider } from "@agari/markets";
import { useReadingQuery } from "@agari/markets/react";

/** The proof strip shows the newest few; the index answers them from one `markets?settled=1` read. */
const SETTLED_SHOWN = 5;
/** A Window settles at most every five minutes: a minute of freshness is honest, and a tab that returns reads it again. */
const STALE_MS = 60_000;
/** As the archive reads (D-086): an unused entry lives half an hour, so leaving `/` and coming back costs nothing. */
const GC_MS = 30 * 60_000;

/**
 * The venue's last settled Windows, newest first, for the landing's proof strip. The markets port's own `listSettled`
 * over the index; no poll (the landing is a story, not a board), and only the venue boot fact, as the lane read needs.
 * The key sits beside the markets family (`agari/markets/…`) without joining its write invalidation: a call never
 * changes which Windows settled.
 */
export function useSettledWindows(venueId: Address | null): Reading<EventMarket[]> | null {
  return useReadingQuery(["agari", "landing", "settled", venueId, SETTLED_SHOWN], () => marketsProvider.listSettled(venueId as Address, SETTLED_SHOWN), {
    enabled: venueId !== null,
    staleTimeMs: STALE_MS,
    gcTimeMs: GC_MS,
    needs: ["venue"],
  });
}
