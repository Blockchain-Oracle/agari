import type { Address } from "@agari/core/types";
import { newSessionKeySeed, SESSION_KEY_SEED_BYTES, sessionKeyFromSeed } from "@agari/markets/sessions/mobile";
import * as SecureStore from "expo-secure-store";
import type { StoredSessionKey } from "@/features/session/store";

/** This device only, while unlocked: never synced to iCloud Keychain or restored from a backup onto another phone. */
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };
// Base58 is case-sensitive: the owner is keyed exactly as written (D-010). SecureStore keys allow [A-Za-z0-9._-].
const seedKey = (owner: Address) => `agari.sessionKey.${owner}`;
const createdKey = (owner: Address) => `agari.sessionKey.${owner}.created`;

const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const fromHex = (hex: string) => Uint8Array.from(hex.match(/../g) ?? [], (h) => Number.parseInt(h, 16));

/**
 * web's session key store (features/session/store.ts) for a phone (D-128): one key per owner, its 32-byte seed in the
 * Keychain / Keystore, imported non-extractable to sign and never logged or kept anywhere else. The record handed back
 * is web's v2 shape, so web's provider logic and `useKeySession` take it unchanged.
 */
export async function loadSessionKey(owner: Address): Promise<StoredSessionKey | null> {
  try {
    const hex = await SecureStore.getItemAsync(seedKey(owner), OPTIONS);
    if (!hex || hex.length !== SESSION_KEY_SEED_BYTES * 2) return null;
    const key = await sessionKeyFromSeed(fromHex(hex));
    const created = Number(await SecureStore.getItemAsync(createdKey(owner), OPTIONS));
    return { v: 2, address: key.address, keyPair: key.keyPair, createdAtMs: Number.isFinite(created) ? created : 0 };
  } catch {
    return null;
  }
}

/** A fresh key for the owner, stored before it is returned; null when the secure store refused (the arm then says so). */
export async function createSessionKey(owner: Address): Promise<StoredSessionKey | null> {
  try {
    const { seed, key } = await newSessionKeySeed();
    const createdAtMs = Date.now();
    await SecureStore.setItemAsync(seedKey(owner), toHex(seed), OPTIONS);
    await SecureStore.setItemAsync(createdKey(owner), String(createdAtMs), OPTIONS);
    seed.fill(0);
    return { v: 2, address: key.address, keyPair: key.keyPair, createdAtMs };
  } catch {
    return null;
  }
}

export async function forgetSessionKey(owner: Address): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(seedKey(owner), OPTIONS);
    await SecureStore.deleteItemAsync(createdKey(owner), OPTIONS);
  } catch {
    // nothing to forget where the store never worked
  }
}
