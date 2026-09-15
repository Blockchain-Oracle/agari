"use client";

import { isAddress, type Address } from "@agari/core/types";
import type { SessionKey } from "@agari/markets";
import { del, get, set } from "idb-keyval";

/**
 * One key per owner, kept in IndexedDB: it survives reloads, and clearing site data deletes it — by design.
 * Record v2 (tap-trading.md §2, D-066) holds the non-extractable `CryptoKeyPair` itself: structured clone keeps
 * `[[extractable]] = false`, so the secret never exists as bytes in the page.
 */
export interface StoredSessionKey {
  v: 2;
  address: Address;
  keyPair: SessionKey["keyPair"];
  createdAtMs: number;
}

const KEY_PREFIX = "agari.sessionKey.";
const DEVICE_KEY = "agari.device";

// Base58 is case-sensitive: the owner key is stored exactly as written (D-010).
const keyFor = (owner: Address) => `${KEY_PREFIX}${owner}`;

/** A v1 base58 record, an extractable key or anything corrupted reads as no key; the owner re-enables (devnet, no migration). */
function isStoredSessionKey(value: unknown): value is StoredSessionKey {
  const v = value as Partial<StoredSessionKey> | null;
  if (!v || v.v !== 2 || !isAddress(v.address) || typeof v.createdAtMs !== "number") return false;
  const pair = v.keyPair as { privateKey?: unknown; publicKey?: unknown } | undefined;
  const privateKey = pair?.privateKey;
  return typeof CryptoKey !== "undefined" && privateKey instanceof CryptoKey && pair?.publicKey instanceof CryptoKey && !privateKey.extractable;
}

export async function loadSessionKey(owner: Address): Promise<StoredSessionKey | null> {
  try {
    const stored = await get<unknown>(keyFor(owner));
    return isStoredSessionKey(stored) ? stored : null;
  } catch {
    return null;
  }
}

export async function saveSessionKey(owner: Address, key: StoredSessionKey): Promise<boolean> {
  try {
    await set(keyFor(owner), key);
    return true;
  } catch {
    return false;
  }
}

export async function forgetSessionKey(owner: Address): Promise<void> {
  try {
    await del(keyFor(owner));
  } catch {
    // nothing to forget where storage never worked
  }
}

/** A random id per browser for the sponsor's per-device gate; empty where storage is unavailable, and the gate then refuses. */
export function deviceId(): string {
  try {
    const existing = window.localStorage.getItem(DEVICE_KEY);
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem(DEVICE_KEY, fresh);
    return fresh;
  } catch {
    return "";
  }
}
