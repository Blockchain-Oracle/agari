import { haptic } from "~/components/kit/haptics";
import { playSfx } from "~/games/audio";

/**
 * web's `lucky/reel-sfx.ts` voices on the phone. Web synthesises them with WebAudio oscillators; the app has no
 * synth, so each voice is the nearest sample from the shared Kenney set, and the ratchet under the spin (a hair of
 * noise on web) is a Taptic selection tick instead — the reel is felt, not heard, between the landings. Every voice
 * obeys the effects slider (`playSfx`) and the player's haptics setting (`haptics`).
 */

/** The reels take off. */
export function reelSpin(haptics: boolean): void {
  playSfx("swipe-up");
  if (haptics) haptic.tap();
}

/** One detent of the ratchet while any reel is moving. */
export function reelTick(haptics: boolean): void {
  if (haptics) haptic.select();
}

/** A reel lands; the last one lands heavier. */
export function reelLock(last: boolean, haptics: boolean): void {
  playSfx("click");
  if (!haptics) return;
  if (last) haptic.heavy();
  else haptic.tap();
}

/** The machine commits to its Window. */
export function reelPick(haptics: boolean): void {
  playSfx("match-found");
  if (haptics) haptic.success();
}

/** The verdict was a win. */
export function luckyWinSting(haptics: boolean): void {
  playSfx("duel-win");
  if (haptics) haptic.success();
}

/** The verdict was a miss: brief, never a nag. */
export function luckyLoseSting(haptics: boolean): void {
  playSfx("duel-lose");
  if (haptics) haptic.error();
}
