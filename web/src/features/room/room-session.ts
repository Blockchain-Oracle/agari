"use client";

import { ROOM_TOKEN_TTL_MS } from "./protocol";

/**
 * A joined Room, remembered for the token's lifetime.
 *
 * The join token is a stateless bearer the server mints for one wallet and one market, good for
 * `ROOM_TOKEN_TTL_MS`. It used to live in a ref inside the Room's own subtree, so closing the sheet
 * unmounted it and every reopen asked the wallet to sign again — the owner's complaint of 2026-09-04
 * ("I signed once; why does looking at the room need another signature?"). The reference keeps its
 * room identity in `localStorage` (`roomDelegate.ts` L30–37) for the same reason.
 *
 * Kept per wallet and market, with the expiry beside it, so a token is never presented after the
 * server would refuse it; a 401 clears it either way. Storage access is best-effort — a private
 * window or a blocked store degrades to the in-memory map, never to an error.
 */
interface StoredRoomToken {
  token: string;
  expiresAtMs: number;
}

/** A little under the server's TTL, so a token is dropped here before it can age out mid-poll. */
const EXPIRY_MARGIN_MS = 30_000;
const PREFIX = "masayume:room:";

const memory = new Map<string, StoredRoomToken>();

const keyFor = (address: string, marketId: string) => `${address.toLowerCase()}:${marketId}`;

function readStore(key: string): StoredRoomToken | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredRoomToken>;
    return typeof parsed.token === "string" && typeof parsed.expiresAtMs === "number" ? { token: parsed.token, expiresAtMs: parsed.expiresAtMs } : null;
  } catch {
    return null;
  }
}

function writeStore(key: string, value: StoredRoomToken | null): void {
  try {
    if (value) window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
    else window.localStorage.removeItem(PREFIX + key);
  } catch {
    // Storage refused; the in-memory copy still serves this tab.
  }
}

/** The live token for this wallet on this market, or null when none was issued or it has aged out. */
export function readRoomToken(address: string, marketId: string, nowMs = Date.now()): string | null {
  if (typeof window === "undefined") return null;
  const key = keyFor(address, marketId);
  const stored = memory.get(key) ?? readStore(key);
  if (!stored) return null;
  if (stored.expiresAtMs <= nowMs) {
    clearRoomToken(address, marketId);
    return null;
  }
  memory.set(key, stored);
  return stored.token;
}

export function writeRoomToken(address: string, marketId: string, token: string, issuedAtMs = Date.now()): void {
  const key = keyFor(address, marketId);
  const value = { token, expiresAtMs: issuedAtMs + ROOM_TOKEN_TTL_MS - EXPIRY_MARGIN_MS };
  memory.set(key, value);
  if (typeof window !== "undefined") writeStore(key, value);
}

export function clearRoomToken(address: string, marketId: string): void {
  const key = keyFor(address, marketId);
  memory.delete(key);
  if (typeof window !== "undefined") writeStore(key, null);
}
