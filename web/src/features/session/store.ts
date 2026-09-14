"use client";

import { isAddress, isBase58OfLength, type Address } from "@agari/core/types";
import { del, get, set } from "idb-keyval";

/** One key per owner, kept in IndexedDB: it survives reloads, and clearing site data deletes it — by design. */
export interface StoredSessionKey {
  address: Address;
  /** base58 of the 64-byte Solana secret key (seed ‖ public key), from `generateSessionKey`. */
  secretKey: string;
  createdAtMs: number;
}

const KEY_PREFIX = "agari.sessionKey.";
const DEVICE_KEY = "agari.device";

// Base58 is case-sensitive: the owner key is stored exactly as written (D-010).
const keyFor = (owner: Address) => `${KEY_PREFIX}${owner}`;

/** Anything that isn't a Solana session key (an old or corrupted record) reads as no key. */
function isStoredSessionKey(value: unknown): value is StoredSessionKey {
  const v = value as Partial<StoredSessionKey> | null;
  return !!v && isAddress(v.address) && isBase58OfLength(v.secretKey, 64) && typeof v.createdAtMs === "number";
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
