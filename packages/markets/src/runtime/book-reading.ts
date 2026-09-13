/**
 * The value logic behind the coordinator's book fan-out, kept pure and separate from its lifecycle.
 *
 * Everything here answers one question: given the book the live store just handed us, does any
 * subscriber need to hear about it? Getting that wrong in the "hold" direction freezes the book on
 * screen, which is why it lives apart from the wiring and is checked on its own.
 */
import { ok, stale, type ReadingOk } from "@masayume/core/schemas";
import type { BookDepth, BookLevelView } from "@masayume/core/types";

function sameLevels(a: readonly BookLevelView[], b: readonly BookLevelView[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const left = a[i]!;
    const right = b[i]!;
    // `priceBps` is derived from `priceRaw` and the market's decimals, so it carries no information
    // these two do not: comparing it as well would only cost time.
    if (left.priceRaw !== right.priceRaw || left.quantityRaw !== right.quantityRaw) return false;
  }
  return true;
}

/**
 * Whether two normalised books carry the same resting liquidity.
 *
 * The live store re-derives its book on every block (its memo cache is keyed on a version that
 * every new head bumps), so a book that has not changed still arrives as a fresh object every
 * block. Comparing the mapped value is what lets the coordinator hold one reading — and therefore
 * one render — across every block in which no order moved.
 */
export function sameBookDepth(a: BookDepth, b: BookDepth): boolean {
  return (
    a.decimals === b.decimals &&
    sameLevels(a.upBids, b.upBids) &&
    sameLevels(a.upAsks, b.upAsks) &&
    sameLevels(a.downBids, b.downBids) &&
    sameLevels(a.downAsks, b.downAsks)
  );
}

/** Keeps the previous value object when the liquidity is identical, so downstream memos hold. */
export function reuseBookValue(previous: BookDepth | undefined, next: BookDepth): BookDepth {
  return previous && sameBookDepth(previous, next) ? previous : next;
}

/** `hold` means every subscriber already has this exact reading; nothing is notified. */
export type BookEmit = { hold: true } | { hold: false; reading: ReadingOk<BookDepth> };

/**
 * Whether the entry's reading has to change.
 *
 * `confirmedAtMs` is the last moment the value was confirmed against a live tail — not the moment
 * it last changed. The coordinator advances it every block without emitting, so a book that sat
 * unchanged for minutes and then went offline reports how recently it was actually confirmed,
 * rather than how long ago it last moved.
 */
export function decideBookEmit(
  previous: ReadingOk<BookDepth> | null,
  value: BookDepth,
  live: boolean,
  confirmedAtMs: number,
): BookEmit {
  if (previous && previous.value === value && previous.stale === !live) return { hold: true };
  const fresh = ok(value, confirmedAtMs);
  return { hold: false, reading: live ? fresh : stale(fresh, "offline") };
}
