"use client";

import type { Address } from "@masayume/core/types";
import { useCallback, useEffect, useState } from "react";
import type { LuckyBoardWire, LuckyHistoryWire } from "./lucky-wire";

/**
 * A wallet's spins and the streak ladder, polled the way the duel's history is (Flicky: eight seconds,
 * no socket). Reading the history is what reconciles open rows against the chain on the server, so the
 * poll is also what lets a verdict reach a player still on the page.
 */
const HISTORY_POLL_MS = 8_000;
const BOARD_POLL_MS = 30_000;

export function useLuckyHistory(wallet: Address | null): { feed: LuckyHistoryWire | null; refresh: () => void } {
  const [feed, setFeed] = useState<LuckyHistoryWire | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!wallet) {
      setFeed(null);
      return;
    }
    let alive = true;
    const load = () =>
      fetch(`/api/games/lucky/history?address=${wallet}`)
        .then((r) => r.json() as Promise<LuckyHistoryWire>)
        .then((body) => {
          if (alive && Array.isArray(body.rows)) setFeed(body);
        })
        .catch(() => undefined);
    void load();
    const timer = setInterval(() => void load(), HISTORY_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [wallet, nonce]);

  return { feed, refresh: useCallback(() => setNonce((n) => n + 1), []) };
}

export function useLuckyBoard(): LuckyBoardWire | null {
  const [board, setBoard] = useState<LuckyBoardWire | null>(null);
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/games/lucky/board")
        .then((r) => r.json() as Promise<LuckyBoardWire>)
        .then((body) => {
          if (alive && Array.isArray(body.rows)) setBoard(body);
        })
        .catch(() => undefined);
    void load();
    const timer = setInterval(() => void load(), BOARD_POLL_MS);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);
  return board;
}
