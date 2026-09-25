import { createAudioPlayer, type AudioPlayer } from "expo-audio";

/**
 * The onboarding's three sounds, made for it with ElevenLabs sound effects (09-25) and levelled with ffmpeg: the brand
 * chime under the intro, a soft tick per page, a bright chime on finishing. Quiet by design (the tick sits well under
 * the chimes), they follow the ringer switch like the rest of the app's UI sound, and a load or play failure is
 * swallowed — onboarding never waits on audio.
 */
const SOURCES = {
  intro: require("../../../assets/sounds/onboard-intro.mp3"),
  page: require("../../../assets/sounds/onboard-page.mp3"),
  done: require("../../../assets/sounds/onboard-done.mp3"),
} as const;
const VOLUME: Record<OnboardingSound, number> = { intro: 0.55, page: 0.35, done: 0.6 };

export type OnboardingSound = keyof typeof SOURCES;

const players = new Map<OnboardingSound, AudioPlayer>();

function player(name: OnboardingSound): AudioPlayer | null {
  try {
    let held = players.get(name);
    if (!held) {
      held = createAudioPlayer(SOURCES[name]);
      held.volume = VOLUME[name];
      players.set(name, held);
    }
    return held;
  } catch {
    return null;
  }
}

/** Decodes all three before the first is needed, so the intro chime lands with the mark. */
export function preloadOnboardingSounds(): void {
  (Object.keys(SOURCES) as OnboardingSound[]).forEach(player);
}

export function playOnboarding(name: OnboardingSound): void {
  const held = player(name);
  if (!held) return;
  try {
    void held.seekTo(0);
    held.play();
  } catch {
    // A sound that cannot play is simply not heard.
  }
}

/** Frees the players once onboarding is over; the app never plays these again. */
export function releaseOnboardingSounds(): void {
  players.forEach((held) => {
    try {
      held.remove();
    } catch {
      // Already released.
    }
  });
  players.clear();
}
