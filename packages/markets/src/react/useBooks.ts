import type { BookTarget } from "@masayume/core/ports";
import type { Reading } from "@masayume/core/schemas";
import type { BookDepth } from "@masayume/core/types";
import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";
import { bookSnapshot, subscribeBook } from "../runtime/coordinator";

const NONE: readonly (Reading<BookDepth> | null)[] = [];

/**
 * The live books of several markets at once — `useBook` over a list, sharing the coordinator's
 * one entry per market with every other consumer (the hero, the cards, the ticket).
 *
 * A surface that reads every Window of an asset needs the books side by side, and hooks cannot
 * be called in a loop of varying length. One subscription over all the targets, and one snapshot
 * array whose identity holds while no book in it changed, is what `useSyncExternalStore` needs.
 * Entries are null while their watch is still hydrating, as with `useBook`.
 */
export function useBooks(targets: readonly BookTarget[]): readonly (Reading<BookDepth> | null)[] {
  // Keyed by content: callers build the list from a lane set on every render.
  const key = targets.map((t) => `${t.marketId}:${t.poolAddress}:${t.decimals}`).join("|");
  const stable = useMemo(
    () => targets.map((t) => ({ marketId: t.marketId, poolAddress: t.poolAddress, decimals: t.decimals })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the list's identity
    [key],
  );
  const last = useRef<readonly (Reading<BookDepth> | null)[]>(NONE);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const releases = stable.map((target) => subscribeBook(target, onChange));
      return () => {
        for (const release of releases) release();
      };
    },
    [stable],
  );

  const read = useCallback(() => {
    const next = stable.map((target) => bookSnapshot(target.marketId));
    const prev = last.current;
    if (prev.length === next.length && prev.every((reading, i) => reading === next[i])) return prev;
    last.current = next;
    return next;
  }, [stable]);

  return useSyncExternalStore(subscribe, read, () => NONE);
}
