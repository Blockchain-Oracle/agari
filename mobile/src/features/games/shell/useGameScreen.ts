import type { GameId } from "@agari/core/games";
import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { preloadGameAudio, wantBgm } from "~/games/audio";
import { rememberGame } from "./last-game";

/**
 * What web's games frame does for every stage, per screen on the phone: remember this mode for the hub's
 * "pick up where you left off", load the samples, and play the music bed while the screen is focused (it
 * stops when the screen is left, covered, or the app goes to the background).
 */
export function useGameScreen(id: GameId): void {
  useFocusEffect(
    useCallback(() => {
      rememberGame(id);
      preloadGameAudio();
      wantBgm(true);
      return () => wantBgm(false);
    }, [id]),
  );
}
