import { useGameSettingsStore } from "@/features/games/settings";
import { setSfxVolume, useGameVolumes } from "./audio";
import { fireFeedback } from "./feedback";

/** The practice screen's cue hook over the shared engine; web's own settings keys, so both apps remember the same. */
export function useNativeFeedback() {
  const store = useGameSettingsStore();
  const { sfx } = useGameVolumes();
  const cue = (name: "up" | "down" | "win" | "loss") =>
    fireFeedback({ up: "swipe-up", down: "swipe-down", win: "card-win", loss: "card-loss" }[name] as "swipe-up", { haptics: store.settings.haptics });
  return {
    sound: sfx > 0,
    haptics: store.settings.haptics,
    cue,
    setSound: (on: boolean) => setSfxVolume(on ? 1 : 0),
    setHaptics: store.setHaptics,
  };
}
