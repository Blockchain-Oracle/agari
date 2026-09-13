"use client";

import type { Address, Hex } from "@masayume/core/types";
import { generateSessionKey } from "@masayume/markets";
import { del, get, set } from "idb-keyval";
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { privateKeyToAccount } from "viem/accounts";
import { useWalletSession } from "@/lib/wallet-session";

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
 */
const KEY_PREFIX = "masayume.gameKey.";

export interface StoredGameKey {
  address: Address;
  privateKey: Hex;
  createdAtMs: number;
}

export interface GameKey {
  address: Address;
  privateKey: Hex;
  /** Signs as the key — a message, never a transaction, and never a prompt. */
  signMessage: (message: string) => Promise<Hex>;
}

const idFor = (owner: Address) => `${KEY_PREFIX}${owner.toLowerCase()}`;

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
    if (held?.privateKey) return held;
    const fresh = generateSessionKey(owner);
    const record: StoredGameKey = { address: fresh.address, privateKey: fresh.privateKey, createdAtMs: fresh.createdAtMs };
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
    if (!stored) return null;
    const account = privateKeyToAccount(stored.privateKey);
    return { address: stored.address, privateKey: stored.privateKey, signMessage: (message: string) => account.signMessage({ message }) };
  }, [stored]);
}
