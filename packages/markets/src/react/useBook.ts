import type { BookTarget } from "@masayume/core/ports";
import type { Reading } from "@masayume/core/schemas";
import type { BookDepth } from "@masayume/core/types";
import { useCallback, useSyncExternalStore } from "react";
import { bookSnapshot, subscribeBook } from "../runtime/coordinator";

/**
 * The live book for one market, normalised once by the coordinator and shared by every consumer.
 *
 * Keyed by market id so a stale page shows an empty book rather than the successor market's
 * liquidity (canon #3). Null while the watch is still hydrating — "…" rather than an empty book
 * nobody has actually read.
 *
 * There is deliberately no `depth` argument. Asking the live store for a second depth forks its
 * memo cache and makes it walk the whole resting-order map again; the reading carries
 * `CANONICAL_BOOK_DEPTH` levels and callers slice what they display out of it. The identity of the
 * returned reading is stable while the resting liquidity is unchanged, so slicing in a `useMemo`
 * downstream actually holds.
 */
export function useBook(target: BookTarget | null): Reading<BookDepth> | null {
  // Destructured to primitives: callers build `target` inline, so depending on the object itself
  // would resubscribe on every render.
  const marketId = target?.marketId ?? null;
  const poolAddress = target?.poolAddress ?? null;
  const decimals = target?.decimals ?? 0;

  const subscribe = useCallback(
    (onChange: () => void) => {
      if (marketId === null || poolAddress === null) return () => undefined;
      return subscribeBook({ marketId, poolAddress, decimals }, onChange);
    },
    [marketId, poolAddress, decimals],
  );
  const read = useCallback(() => bookSnapshot(marketId), [marketId]);

  return useSyncExternalStore(subscribe, read, () => null);
}
