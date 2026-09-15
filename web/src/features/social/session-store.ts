"use client";

import type { SocialSession } from "./protocol";

/**
 * A social session, remembered per wallet for the token's lifetime (the Room's `room-session.ts` pattern): follow and
 * unfollow reuse it, so the wallet signs once an hour rather than once a click. Storage is best-effort; a private
 * window or a blocked store degrades to this tab's memory, never to an error. A 401 clears it either way.
 */

/** A little under the server's TTL, so a token is dropped here before the server would refuse it. */
const EXPIRY_MARGIN_MS = 30_000;
const PREFIX = "agari:social:";
const memory = new Map<string, SocialSession>();

function readStore(address: string): SocialSession | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + address);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SocialSession>;
    return typeof parsed.token === "string" && typeof parsed.expiresAtMs === "number" ? { token: parsed.token, expiresAtMs: parsed.expiresAtMs } : null;
  } catch {
    return null;
  }
}

function writeStore(address: string, value: SocialSession | null): void {
  try {
    if (value) window.localStorage.setItem(PREFIX + address, JSON.stringify(value));
    else window.localStorage.removeItem(PREFIX + address);
  } catch {
    // Storage refused; the in-memory copy still serves this tab.
  }
}

/** The live token for this wallet (exact base58, D-010), or null when none was issued or it has aged out. */
export function readSocialToken(address: string, nowMs = Date.now()): string | null {
  if (typeof window === "undefined") return null;
  const stored = memory.get(address) ?? readStore(address);
  if (!stored) return null;
  if (stored.expiresAtMs - EXPIRY_MARGIN_MS <= nowMs) {
    clearSocialToken(address);
    return null;
  }
  memory.set(address, stored);
  return stored.token;
}

export function writeSocialToken(address: string, session: SocialSession): void {
  memory.set(address, session);
  if (typeof window !== "undefined") writeStore(address, session);
}

export function clearSocialToken(address: string): void {
  memory.delete(address);
  if (typeof window !== "undefined") writeStore(address, null);
}
