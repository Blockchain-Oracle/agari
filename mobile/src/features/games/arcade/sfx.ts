import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { gameAudioReady } from "~/games/audio";

/**
 * web's `arcade/arcade-sfx.ts` on the phone. Web synthesizes these voices on the Web Audio effects bus; the phone
 * has no oscillators, so it plays offline renders of the same graphs (`scripts/render-arcade-sfx.mjs`). The two
 * voices that move with the run are rendered in steps: the hop's "tuiing" climbs one step every five gaps up to
 * web's cap at forty, and the ride's milestone tick climbs a semitone per whole multiplier up to an octave.
 *
 * Same grammar as `~/games/audio`: two players per sound so a quick second cue overlaps the first, web's effects
 * slider under its own key × web's 0.6, silent at zero, and every load or play failure swallowed.
 */
const HOP_SCORE = [
  require("../../../../assets/sounds/arcade-hop-score-0.wav"),
  require("../../../../assets/sounds/arcade-hop-score-1.wav"),
  require("../../../../assets/sounds/arcade-hop-score-2.wav"),
  require("../../../../assets/sounds/arcade-hop-score-3.wav"),
  require("../../../../assets/sounds/arcade-hop-score-4.wav"),
  require("../../../../assets/sounds/arcade-hop-score-5.wav"),
  require("../../../../assets/sounds/arcade-hop-score-6.wav"),
  require("../../../../assets/sounds/arcade-hop-score-7.wav"),
  require("../../../../assets/sounds/arcade-hop-score-8.wav"),
] as const;

const MILESTONE = [
  require("../../../../assets/sounds/arcade-milestone-0.wav"),
  require("../../../../assets/sounds/arcade-milestone-1.wav"),
  require("../../../../assets/sounds/arcade-milestone-2.wav"),
  require("../../../../assets/sounds/arcade-milestone-3.wav"),
  require("../../../../assets/sounds/arcade-milestone-4.wav"),
  require("../../../../assets/sounds/arcade-milestone-5.wav"),
  require("../../../../assets/sounds/arcade-milestone-6.wav"),
  require("../../../../assets/sounds/arcade-milestone-7.wav"),
  require("../../../../assets/sounds/arcade-milestone-8.wav"),
  require("../../../../assets/sounds/arcade-milestone-9.wav"),
  require("../../../../assets/sounds/arcade-milestone-10.wav"),
  require("../../../../assets/sounds/arcade-milestone-11.wav"),
  require("../../../../assets/sounds/arcade-milestone-12.wav"),
] as const;

const HOP_CRASH = require("../../../../assets/sounds/arcade-hop-crash.wav");
const RIDE_START = require("../../../../assets/sounds/arcade-ride-start.wav");
const RIDE_CRASH = require("../../../../assets/sounds/arcade-ride-crash.wav");
const REGAIN = require("../../../../assets/sounds/arcade-regain.wav");

const SFX_VOLUME_KEY = "agari.games.sfxVolume";
const SFX_VOLUME_BASE = 0.6;
const POOL = 2;
const HOP_STREAK_CAP = 40;
const HOP_GAPS_PER_STEP = 5;

const pools = new Map<number, { players: AudioPlayer[]; next: number }>();

function sfxVolume(): number {
  try {
    const raw = globalThis.localStorage?.getItem(SFX_VOLUME_KEY);
    const value = raw === null || raw === undefined ? 1 : Number(raw);
    return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
  } catch {
    return 1;
  }
}

function pool(source: number) {
  let entry = pools.get(source);
  if (!entry) {
    entry = { players: Array.from({ length: POOL }, () => createAudioPlayer(source)), next: 0 };
    pools.set(source, entry);
  }
  return entry;
}

function play(source: number): void {
  const volume = sfxVolume();
  if (volume === 0) return;
  try {
    const entry = pool(source);
    const player = entry.players[entry.next % POOL]!;
    entry.next += 1;
    player.volume = SFX_VOLUME_BASE * volume;
    void gameAudioReady()
      .then(() => player.seekTo(0))
      .then(() => player.play())
      .catch(() => undefined);
  } catch {
    // no audio right now: stay silent
  }
}

/** Decode one game's voices before its first cue. */
export function preloadArcadeSfx(game: "line-rider" | "candle-hop"): void {
  try {
    void gameAudioReady();
    const sources = game === "candle-hop" ? [...HOP_SCORE, HOP_CRASH] : [...MILESTONE, RIDE_START, RIDE_CRASH, REGAIN];
    for (const source of sources) pool(source);
  } catch {
    // decoration only
  }
}

/** A gap cleared, the `streak`th in a row (0-based). */
export function hopScoreSfx(streak: number): void {
  const step = Math.floor(Math.min(streak, HOP_STREAK_CAP) / HOP_GAPS_PER_STEP);
  play(HOP_SCORE[Math.min(step, HOP_SCORE.length - 1)]);
}

export function hopCrashSfx(): void {
  play(HOP_CRASH);
}

export function rideStartSfx(): void {
  play(RIDE_START);
}

export function rideCrashSfx(): void {
  play(RIDE_CRASH);
}

/** The combo crossed `mult`: a semitone higher per whole number past ×2, capped an octave up. */
export function milestoneSfx(mult: number): void {
  const steps = Math.min(12, Math.max(0, Math.floor(mult) - 2));
  play(MILESTONE[steps]);
}

export function regainSfx(): void {
  play(REGAIN);
}
