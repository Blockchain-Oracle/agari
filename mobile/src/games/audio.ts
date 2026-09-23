import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { useSyncExternalStore } from "react";
import { AppState } from "react-native";
import type { SfxName } from "@/features/games/audio";

/**
 * Game audio on the phone: web's `features/games/audio.ts` grammar with native players.
 *
 * - The same ten Kenney CC0 samples, two players each so a rapid second swipe overlaps the first instead of cutting it.
 * - The music bed is `assets/sounds/bed.wav`, rendered from web's sequenced `bed.ts` score (`scripts/render-bed.mjs`).
 * - Two persisted sliders under web's own keys (effects, music); dragging either to zero mutes that channel.
 * - The session mixes with other audio: a podcast or playlist in the player's headphones keeps playing under the game
 *   instead of being stopped by it, and effects follow whatever route is active (speaker, wired or Bluetooth).
 * - Every load or play failure is swallowed: a missing sound never breaks a game.
 */
export type { SfxName };

const SOURCES: Readonly<Record<SfxName, number>> = {
  "swipe-up": require("../../assets/sounds/swipe-up.mp3"),
  "swipe-down": require("../../assets/sounds/swipe-down.mp3"),
  "card-win": require("../../assets/sounds/card-win.mp3"),
  "card-loss": require("../../assets/sounds/card-loss.mp3"),
  "match-found": require("../../assets/sounds/match-found.mp3"),
  "duel-win": require("../../assets/sounds/duel-win.mp3"),
  "duel-lose": require("../../assets/sounds/duel-lose.mp3"),
  click: require("../../assets/sounds/click.mp3"),
  "modal-open": require("../../assets/sounds/modal-open.mp3"),
  "modal-close": require("../../assets/sounds/modal-close.mp3"),
};
const BED_SOURCE = require("../../assets/sounds/bed.wav");

/** web's keys and tuned levels: the sliders multiply these, so "100 %" is the designed balance, not full amplitude. */
const SFX_VOLUME_KEY = "agari.games.sfxVolume";
const BGM_VOLUME_KEY = "agari.games.bgmVolume";
const SFX_VOLUME_BASE = 0.6;
const BGM_VOLUME_BASE = 0.3;
const POOL = 2;

const clamp01 = (value: number) => (Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1);
function readVolume(key: string): number {
  try {
    const raw = globalThis.localStorage?.getItem(key);
    return raw === null || raw === undefined ? 1 : clamp01(Number(raw));
  } catch {
    return 1;
  }
}

let sfxVolume = readVolume(SFX_VOLUME_KEY);
let bgmVolume = readVolume(BGM_VOLUME_KEY);
let sessionReady: Promise<void> | null = null;
const pools = new Map<SfxName, { players: AudioPlayer[]; next: number }>();
let bed: AudioPlayer | null = null;
let bgmWanted = false;

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function ensureSession(): Promise<void> {
  if (sessionReady) return sessionReady;
  sessionReady = setAudioModeAsync({
    // The ring/silent switch does not mute game audio the player turned up in the game's own sliders.
    playsInSilentMode: true,
    interruptionMode: "mixWithOthers",
    allowsRecording: false,
    shouldPlayInBackground: false,
  }).catch(() => undefined);
  // A backgrounded app stops its bed (as a hidden tab does) and picks it up again on return.
  AppState.addEventListener("change", (state) => {
    if (state === "active") syncBgm();
    else bed?.pause();
  });
  return sessionReady;
}

/** Arcade cues share the game's audio session and wait for its output policy before their first play. */
export function gameAudioReady(): Promise<void> {
  return ensureSession();
}

function pool(name: SfxName) {
  let entry = pools.get(name);
  if (!entry) {
    entry = { players: Array.from({ length: POOL }, () => createAudioPlayer(SOURCES[name])), next: 0 };
    pools.set(name, entry);
  }
  return entry;
}

/** Load every sample ahead of the first cue, so the first swipe is not silent while its file decodes. */
export function preloadGameAudio(): void {
  void ensureSession();
  for (const name of Object.keys(SOURCES) as SfxName[]) pool(name);
}

export function playSfx(name: SfxName): void {
  if (sfxVolume === 0) return;
  try {
    const ready = ensureSession();
    const entry = pool(name);
    const player = entry.players[entry.next % POOL]!;
    entry.next += 1;
    player.volume = SFX_VOLUME_BASE * sfxVolume;
    void ready.then(() => player.seekTo(0)).then(() => {
      if (sfxVolume > 0 && AppState.currentState === "active") player.play();
    }).catch(() => undefined);
  } catch {
    // no audio on this device right now: stay silent
  }
}

function syncBgm(): void {
  const audible = bgmWanted && bgmVolume > 0 && AppState.currentState === "active";
  try {
    if (!audible) {
      bed?.pause();
      return;
    }
    void ensureSession();
    if (!bed) {
      bed = createAudioPlayer(BED_SOURCE);
      bed.loop = true;
    }
    bed.volume = BGM_VOLUME_BASE * bgmVolume;
    if (!bed.playing) void ensureSession().then(() => {
      if (bgmWanted && bgmVolume > 0 && AppState.currentState === "active") bed?.play();
    });
  } catch {
    // the bed is decoration: never an error
  }
}

/** The games shell asks for the bed while a game is on screen and releases it when it leaves. */
export function wantBgm(on: boolean): void {
  bgmWanted = on;
  syncBgm();
}

export function setSfxVolume(value: number): void {
  sfxVolume = clamp01(value);
  globalThis.localStorage?.setItem(SFX_VOLUME_KEY, String(sfxVolume));
  emit();
}

export function setBgmVolume(value: number): void {
  bgmVolume = clamp01(value);
  globalThis.localStorage?.setItem(BGM_VOLUME_KEY, String(bgmVolume));
  syncBgm();
  emit();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The two sliders as React state. */
export function useGameVolumes(): { sfx: number; bgm: number } {
  const sfx = useSyncExternalStore(subscribe, () => sfxVolume);
  const bgm = useSyncExternalStore(subscribe, () => bgmVolume);
  return { sfx, bgm };
}
