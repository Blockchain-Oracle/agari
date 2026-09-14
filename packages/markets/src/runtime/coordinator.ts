/**
 * The book coordinator: one normalized book per market, shared by every consumer, re-rendering only on real change
 * (the pure decision logic lives in `book-reading.ts`). From S4 it fans out agari-events `Book` account
 * subscriptions; in S1 there is no book to watch, so every market reads the same honest not-deployed reading.
 */
import type { BookTarget } from "@agari/core/ports";
import type { Reading } from "@agari/core/schemas";
import type { BookDepth, MarketId } from "@agari/core/types";
import { notDeployedReading } from "../stub/not-deployed";

/** How many levels each side a coordinated book carries; callers slice what they display. */
export const CANONICAL_BOOK_DEPTH = 32;

/** One frozen reading, so `useSyncExternalStore` sees a stable snapshot and never loops. */
const NO_BOOK: Reading<BookDepth> = Object.freeze(notDeployedReading("no agari-events Book to watch yet (S1 stub)"));

export function bookSnapshot(marketId: MarketId | null): Reading<BookDepth> | null {
  return marketId === null ? null : NO_BOOK;
}

export function subscribeBook(_target: BookTarget, _onChange: () => void): () => void {
  return () => undefined;
}

export function resetCoordinator(): void {}
