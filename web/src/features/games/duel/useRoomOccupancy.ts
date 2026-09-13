"use client";

import { queueKey, type DuelMode, type StakeTierId } from "@masayume/core/games";
import { useEffect, useState } from "react";

/**
 * How many people are waiting, read with no wallet and no signature.
 *
 * This is the answer to "is anyone even here?", and it has to be available before the room asks for
 * anything — a player deciding whether a duel is worth a signature cannot be told to sign first. It is
 * deliberately thin: counts per queue and how many pairs are past it, no wallets, no ratings, nothing
 * that says who.
 *
 * **An unreachable room is a fact, not an error.** `reachable: false` is rendered as "the room is not
 * answering", which is true and actionable, rather than as a zero — a lobby that says "0 waiting" when
 * the service is down tells a player the game is empty when it is actually off.
 */

const ENDPOINT = "/api/games/occupancy";
/** Slow on purpose: this is a lobby number, and the queue itself pushes a live count once a player is in one. */
const POLL_MS = 10_000;

export interface QueueRow {
  key: string;
  mode: string;
  tier: string;
  waiting: number;
}

export interface RoomOccupancy {
  reachable: boolean;
  queues: readonly QueueRow[];
  /** Pairs past the queue: sealing a deck, or waiting on a signature. Still "people in a duel right now". */
  pairing: number;
  online: number;
  nextDeckInSec?: number | null;
}

/** Everyone searching, across every stake — the number a games hub card wants. */
export function searchingNow(occupancy: RoomOccupancy | null): number {
  if (!occupancy) return 0;
  return occupancy.queues.reduce((sum, row) => sum + row.waiting, 0);
}

/** Waiting in one specific queue, which is the number the entry's chosen stake wants. */
export function waitingIn(occupancy: RoomOccupancy | null, mode: DuelMode, tier: StakeTierId, region = "default"): number {
  const key = queueKey(mode, tier, region);
  return occupancy?.queues.find((row) => row.key === key)?.waiting ?? 0;
}

export function useRoomOccupancy(): RoomOccupancy | null {
  const [occupancy, setOccupancy] = useState<RoomOccupancy | null>(null);

  useEffect(() => {
    let alive = true;
    const read = () =>
      void fetch(ENDPOINT)
        .then((response) => response.json() as Promise<RoomOccupancy>)
        .then((body) => alive && setOccupancy(body))
        .catch(() => alive && setOccupancy({ reachable: false, queues: [], pairing: 0, online: 0 }));

    read();
    const timer = setInterval(read, POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return occupancy;
}
