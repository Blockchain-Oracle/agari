import { encodeBase58, type Address, type Signature } from "@agari/core/types";
import * as SecureStore from "expo-secure-store";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { generateGameKeypair, parseStoredSecret, signWithGameKey } from "@/features/games/duel/game-keypair";
import { useWalletSession } from "@/lib/wallet-session";

/**
 * Stands in for web/src/features/games/duel/useGameKey.ts (same exports, same record). The duel's game key is one
 * Ed25519 keypair per wallet. It signs the room's credential, and the entry transaction names it as the seat's
 * agent. web keeps it in IndexedDB. The phone has no IndexedDB, so it goes in the Keychain / Android Keystore
 * (expo-secure-store), for this device only. The keypair itself is still made and used by web's `game-keypair.ts`
 * through WebCrypto Ed25519, which react-native-quick-crypto installs on `globalThis.crypto`.
 * Losing the key loses convenience, never money: a seat can name a new key with `authorizeAgent`.
 */
const KEY_PREFIX = "agari.gameKey.";
const OPTIONS: SecureStore.SecureStoreOptions = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export interface StoredGameKey {
  address: Address;
  /** base58 of the 64-byte Solana secret key. */
  secretKey: string;
  createdAtMs: number;
}

export interface GameKey {
  address: Address;
  secretKey: Uint8Array;
  /** Signs as the key — a message, never a transaction, and never a prompt. Returns the base58 signature. */
  signMessage: (message: string) => Promise<Signature>;
}

/** SecureStore keys allow [A-Za-z0-9._-]; a base58 owner address fits as written (D-010). */
const idFor = (owner: Address) => `${KEY_PREFIX}${owner}`;

const records = new Map<string, StoredGameKey | null>();
const loading = new Map<string, Promise<StoredGameKey | null>>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

async function loadOrCreate(owner: Address): Promise<StoredGameKey | null> {
  try {
    const raw = await SecureStore.getItemAsync(idFor(owner), OPTIONS);
    const held = raw ? (JSON.parse(raw) as StoredGameKey) : null;
    if (held && parseStoredSecret(held.secretKey)) return held;
    const fresh = await generateGameKeypair();
    const record: StoredGameKey = { address: fresh.address, secretKey: encodeBase58(fresh.secretKey), createdAtMs: Date.now() };
    await SecureStore.setItemAsync(idFor(owner), JSON.stringify(record), OPTIONS);
    return record;
  } catch {
    return null;
  }
}

/** The wallet's key, made once and shared: a second caller while the first is still reading waits on the same read. */
export function loadGameKey(owner: Address): Promise<StoredGameKey | null> {
  const id = idFor(owner);
  const held = records.get(id);
  if (held !== undefined) return Promise.resolve(held);
  const pending = loading.get(id);
  if (pending) return pending;
  const task = loadOrCreate(owner).then((record) => {
    records.set(id, record);
    loading.delete(id);
    emit();
    return record;
  });
  loading.set(id, task);
  return task;
}

/** Throws the key away; the next duel makes another. */
export async function forgetGameKey(owner: Address): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(idFor(owner), OPTIONS);
  } catch {
    // nothing to forget where storage never worked
  }
  records.delete(idFor(owner));
  emit();
}

export function useGameKey(): GameKey | null {
  const { address } = useWalletSession();
  const stored = useSyncExternalStore(
    subscribe,
    () => (address ? (records.get(idFor(address)) ?? null) : null),
    () => null,
  );

  useEffect(() => {
    if (address) void loadGameKey(address);
  }, [address]);

  return useMemo(() => {
    const pair = stored ? parseStoredSecret(stored.secretKey) : null;
    if (!pair) return null;
    return { address: pair.address, secretKey: pair.secretKey, signMessage: (message: string) => signWithGameKey(pair.secretKey, message) };
  }, [stored]);
}
