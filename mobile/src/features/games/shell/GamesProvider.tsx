import { activeMatchId as activeMatchIdOf, IDLE, type GameId, type MatchState } from "@agari/core/games";
import { useFonts } from "expo-font";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useReducedMotion } from "react-native-reanimated";
import type { FeedbackCue } from "@/features/games/feedback";
import { reducedMotionFrom, useGameSettingsStore } from "@/features/games/settings";
import { fireFeedback } from "~/games/feedback";
import { PIXEL_FONT, PIXEL_FONT_SOURCE } from "~/theme/web/games";
import { GamesContext, type GamesContextValue } from "./context";
import { GameSettingsSheet } from "./GameSettingsSheet";
import { HowToSheet } from "./HowToSheet";

/**
 * web's `GamesProvider` + `GamesShell`, once for the whole Games tab: the player's settings (one store, so a
 * change in the settings sheet reaches the game screen underneath it at once), the resolved motion answer,
 * the feedback cue that obeys the haptics switch, the active match the duel publishes, and the two sheets
 * every game screen can open from its header.
 */

export function GamesProvider({ children }: { children: ReactNode }) {
  // The frame's pixel face (web's "Agari Pixel"), loaded once for every mode; the mono face stands in until it is.
  useFonts({ [PIXEL_FONT]: PIXEL_FONT_SOURCE });
  const store = useGameSettingsStore();
  const systemPrefersReduced = useReducedMotion();
  const [match, setMatch] = useState<MatchState>(IDLE);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [howTo, setHowTo] = useState<GameId | null>(null);

  const { settings } = store;
  const reducedMotion = reducedMotionFrom(settings.motion, systemPrefersReduced);

  const feedback = useCallback(
    (cue: FeedbackCue) => fireFeedback(cue, { haptics: settings.haptics }),
    [settings.haptics],
  );

  const openSettings = useCallback(() => {
    feedback("tap");
    fireFeedback("modal-open", { haptics: false });
    setSettingsOpen(true);
  }, [feedback]);

  const openHowTo = useCallback(
    (id: GameId) => {
      feedback("tap");
      fireFeedback("modal-open", { haptics: false });
      setHowTo(id);
    },
    [feedback],
  );

  const closeSettings = useCallback(() => {
    fireFeedback("modal-close", { haptics: false });
    setSettingsOpen(false);
  }, []);

  const closeHowTo = useCallback(() => {
    fireFeedback("modal-close", { haptics: false });
    setHowTo(null);
  }, []);

  const value = useMemo<GamesContextValue>(
    () => ({
      settings,
      hydrated: store.hydrated,
      setHaptics: store.setHaptics,
      setMotion: store.setMotion,
      setAccent: store.setAccent,
      systemPrefersReduced,
      reducedMotion,
      feedback,
      match,
      setMatch,
      activeMatchId: activeMatchIdOf(match),
      openSettings,
      openHowTo,
    }),
    [settings, store.hydrated, store.setHaptics, store.setMotion, store.setAccent, systemPrefersReduced, reducedMotion, feedback, match, openSettings, openHowTo],
  );

  return (
    <GamesContext.Provider value={value}>
      {children}
      <GameSettingsSheet open={settingsOpen} onClose={closeSettings} />
      <HowToSheet id={howTo} onClose={closeHowTo} />
    </GamesContext.Provider>
  );
}
