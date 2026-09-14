"use client";

import { encodeBase58, type Address, type Signature } from "@agari/core/types";
import { del, get, set } from "idb-keyval";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useWalletSession } from "@/lib/wallet-session";
import { generateGameKeypair, parseStoredSecret, signWithGameKey } from "./game-keypair";

/**
 * The browser's game key — one per wallet, in IndexedDB beside the tap-trade key's and under its own
 * prefix: a duel's key is not a vault grant, and revoking one must never touch the other.
 *
 * It is the one identity a duel needs before anything touches the chain. It signs the room's credential
 * (`useRoomToken`) so the wallet is never prompted to open a room, and the entry transaction then names it
 * as the seat's agent, which is the moment the chain vouches for the claim it made. Losing it loses a
 * duel's convenience, never money: a seat can name a new one with `authorizeAgent`.
 *
 * One record per wallet, shared by every hook instance through a module store rather than loaded per
 * instance: three components mounting at once used to race `loadOrCreate`, and two of them could have
 * generated a key each and kept the one the store did not.
 *
 * On Solana the key is an Ed25519 keypair made by WebCrypto (`game-keypair.ts`). The record keeps its 64-byte secret
 * (seed ‖ public key) as base58, the Solana CLI's own layout, so the markets session can sign with it as `{ secretKey }`.
 * A Masayume-era record (an EVM hex private key) doesn't parse and is replaced by a fresh key.
 */
const KEY_PREFIX = "agari.gameKey.";

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

/** Base58 is case-sensitive, so the owner's address is the key id exactly as written (D-010). */
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

/** Storage that is simply absent in a private window, and must never throw here. */
async function loadOrCreate(owner: Address): Promise<StoredGameKey | null> {
  try {
    const held = await get<StoredGameKey>(idFor(owner));
    if (held && parseStoredSecret(held.secretKey)) return held;
    const fresh = await generateGameKeypair();
    const record: StoredGameKey = { address: fresh.address, secretKey: encodeBase58(fresh.secretKey), createdAtMs: Date.now() };
    await set(idFor(owner), record);
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
    await del(idFor(owner));
  } catch {
    // nothing to forget where storage never worked
  }
  records.delete(idFor(owner));
  emit();
}

const NONE = null;

export function useGameKey(): GameKey | null {
  const { address } = useWalletSession();
  const stored = useSyncExternalStore(
    subscribe,
    () => (address ? (records.get(idFor(address)) ?? NONE) : NONE),
    () => NONE,
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
