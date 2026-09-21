"use client";

import type { Side } from "@agari/core/types";
import { useSyncExternalStore } from "react";

const KEY = "agari.bet-against";

/**
 * "I think it falls" as a page-wide mode (A-1a).
 *
 * Agari's bearish trade is the one it already has: a DOWN call on the same Window, at the same book, against the
 * same house. What was missing was a way to say so once instead of picking DOWN on every ticket — so this holds
 * the choice, and the surfaces that offer a side put DOWN first while it is on.
 *
 * It is a module store rather than a context because the ticket reaches the page through a render slot
 * (`MarketsPage.renderTicket`), so a provider would have to wrap surfaces that never mention the mode.
 * `useSyncExternalStore` subscribes from anywhere in the tree and matches the server's answer on first paint.
 */
let on = false;
let hydrated = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

/** Reads the browser's stored choice once, after mount, so the server and the first client render agree. */
function hydrate(): void {
  if (hydrated) return;
  hydrated = true;
  try {
    if (window.localStorage.getItem(KEY) === "1") {
      on = true;
      emit();
    }
  } catch {
    // storage unavailable — the mode is simply off this session
  }
}

export function setBetAgainst(next: boolean): void {
  if (on === next) return;
  on = next;
  try {
    window.localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // storage unavailable — the choice still holds for this session
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  hydrate();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useBetAgainst(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => on,
    () => false,
  );
}

/** DOWN first while the mode is on: the side a bearish caller wants is the one under their thumb. */
export function sidesInOrder(betAgainst: boolean): readonly Side[] {
  return betAgainst ? ["down", "up"] : ["up", "down"];
}

/** The side an entry that names none should open on. */
export function defaultSide(betAgainst: boolean): Side | undefined {
  return betAgainst ? "down" : undefined;
}
