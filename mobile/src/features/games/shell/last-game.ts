import type { GameId } from "@agari/core/games";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { gameEntry, gameIdFromPath } from "./catalog";

/**
 * web's `features/games/last-game.ts`: the last game a player opened, under web's own key, offered first on
 * the hub. Game screens write it as they gain focus (`useGameScreen`); the hub reads it each time it does.
 */
const KEY = "agari.games.last";

export interface LastGame {
  id: GameId;
  href: string;
  name: string;
}

export function rememberGame(id: GameId): void {
  try {
    globalThis.localStorage?.setItem(KEY, id);
  } catch {
    // storage refused: nothing to remember
  }
}

function readLastGame(): LastGame | null {
  try {
    const id = gameIdFromPath(`/games/${globalThis.localStorage?.getItem(KEY) ?? ""}`);
    if (!id) return null;
    const entry = gameEntry(id);
    return entry.readiness.kind === "built" ? { id, href: entry.nav.href, name: entry.nav.name } : null;
  } catch {
    return null;
  }
}

/** Re-read whenever the hub comes back into focus, so returning from a game offers that game. */
export function useLastGame(): LastGame | null {
  const [last, setLast] = useState<LastGame | null>(null);
  useFocusEffect(
    useCallback(() => {
      setLast(readLastGame());
    }, []),
  );
  return last;
}
