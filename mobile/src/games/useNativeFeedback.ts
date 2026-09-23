import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { useEffect, useState } from "react";
import { storage } from "~/lib/storage";

const SOUND_KEY = "agari.mobile.gameSound";
const HAPTICS_KEY = "agari.mobile.gameHaptics";

/** Short local effects follow the current output route, including connected headphones. */
export function useNativeFeedback() {
  const [sound, setSound] = useState(() => storage.getBoolean(SOUND_KEY) ?? true);
  const [haptics, setHaptics] = useState(() => storage.getBoolean(HAPTICS_KEY) ?? true);
  const up = useAudioPlayer(require("../../assets/sounds/swipe-up.mp3"));
  const down = useAudioPlayer(require("../../assets/sounds/swipe-down.mp3"));
  const win = useAudioPlayer(require("../../assets/sounds/card-win.mp3"));
  const loss = useAudioPlayer(require("../../assets/sounds/card-loss.mp3"));

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "mixWithOthers",
      allowsRecording: false,
      shouldPlayInBackground: false,
      shouldRouteThroughEarpiece: false,
    });
  }, []);

  const cue = (name: "up" | "down" | "win" | "loss") => {
    if (sound) {
      const player = { up, down, win, loss }[name];
      void player.seekTo(0).then(() => player.play()).catch(() => undefined);
    }
    if (haptics) {
      if (name === "win" || name === "loss") void Haptics.notificationAsync(name === "win" ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error);
      else void Haptics.selectionAsync();
    }
  };
  return {
    sound, haptics, cue,
    setSound: (next: boolean) => { storage.set(SOUND_KEY, next); setSound(next); },
    setHaptics: (next: boolean) => { storage.set(HAPTICS_KEY, next); setHaptics(next); },
  };
}
