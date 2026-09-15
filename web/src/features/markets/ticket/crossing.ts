import type { BookDepth, Side } from "@agari/core/types";

/** The venue's price scale: 1,000 ticks a pair, 10 ticks a cent, 100 bps a cent on the book reading. */
const BPS_PER_CENT = 100;
const CENTS_PER_PAIR = 100;

export interface Crossing {
  /** The side already offered on the book, in the caller's words: "Someone wants UP". */
  otherSide: Side;
  otherCents: number;
  /** The highest whole cent the call can rest at without taking that offer; 0 when nothing rests under it. */
  maxCents: number;
}

/**
 * Whether a post-only call at `priceCents` would take the book instead of resting (the engine's 6109), from the live
 * depth: a call on one side takes that side's best ask when its price reaches the ask. A UP call at 55¢ meets a UP ask
 * at 55.4¢ only from 56¢, so the ask is read in whole cents rounded up and the call may rest one cent under it. The
 * other side's price is the pair's complement ("someone wants DOWN at 44¢" behind a UP ask at 56¢).
 */
export function crossingOf(side: Side, priceCents: number, book: Pick<BookDepth, "upAsks" | "downAsks">): Crossing | null {
  const ask = side === "up" ? book.upAsks[0] : book.downAsks[0];
  if (!ask) return null;
  const askCents = Math.ceil(ask.priceBps / BPS_PER_CENT);
  if (priceCents < askCents) return null;
  return { otherSide: side === "up" ? "down" : "up", otherCents: CENTS_PER_PAIR - askCents, maxCents: askCents - 1 };
}
