"use client";

import type { Address, Hex } from "@masayume/core/types";
import { del, get, set } from "idb-keyval";

/** One key per owner, kept in IndexedDB: it survives reloads, and clearing site data deletes it — by design. */
export interface StoredSessionKey {
  address: Address;
  privateKey: Hex;
  createdAtMs: number;
}

const KEY_PREFIX = "masayume.sessionKey.";
const DEVICE_KEY = "masayume.device";

const keyFor = (owner: Address) => `${KEY_PREFIX}${owner.toLowerCase()}`;

export async function loadSessionKey(owner: Address): Promise<StoredSessionKey | null> {
  try {
    return (await get<StoredSessionKey>(keyFor(owner))) ?? null;
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
