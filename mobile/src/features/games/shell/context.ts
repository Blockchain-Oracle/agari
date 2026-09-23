import type { GameId, MatchState } from "@agari/core/games";
import { createContext, useContext } from "react";
import type { FeedbackCue } from "@/features/games/feedback";
import type { AccentChoice, GameSettings, MotionChoice } from "@/features/games/settings";

/** What the Games tab's shell hands every screen under it (web's `useGames()`). */
export interface GamesContextValue {
  settings: GameSettings;
  hydrated: boolean;
  setHaptics: (on: boolean) => void;
  setMotion: (choice: MotionChoice) => void;
  setAccent: (accent: AccentChoice) => void;
  /** What the OS asks for right now, so settings can say which way "Follow system" resolves. */
  systemPrefersReduced: boolean;
  /** The answer every stage uses: the player's explicit choice, or the OS when there is none. */
  reducedMotion: boolean;
  /** One call per cue; it consults the haptics setting so no caller has to. */
  feedback: (cue: FeedbackCue) => void;
  /** The match the shell believes is in flight: IDLE until the duel stage publishes a real one. */
  match: MatchState;
  setMatch: (state: MatchState) => void;
  activeMatchId: string | null;
  openSettings: () => void;
  openHowTo: (id: GameId) => void;
}

export const GamesContext = createContext<GamesContextValue | null>(null);

/** Throws outside the Games tab, which is the point: a stage without the shell has no settings to obey. */
export function useGames(): GamesContextValue {
  const value = useContext(GamesContext);
  if (!value) throw new Error("useGames must be used inside the Games tab layout");
  return value;
}
