import type { FeedbackCue } from "@/features/games/feedback";
import { haptic } from "~/components/kit/haptics";
import { playSfx, type SfxName } from "./audio";

/**
 * web's `features/games/feedback.ts` on the phone: one cue, a sample and a buzz. The sample table is web's; the buzz
 * is the Taptic/Android haptic nearest web's vibration length (web's iOS Safari has no vibration at all, so here the
 * phone does better than the web page it follows).
 */
export type { FeedbackCue };

const SAMPLE: Readonly<Record<FeedbackCue, SfxName | null>> = {
  tap: null,
  confirm: null,
  deny: "card-loss",
  crash: null,
  "swipe-up": "swipe-up",
  "swipe-down": "swipe-down",
  "card-win": "card-win",
  "card-loss": "card-loss",
  "match-found": "match-found",
  "duel-win": "duel-win",
  "duel-lose": "duel-lose",
  click: "click",
  "modal-open": "modal-open",
  "modal-close": "modal-close",
};

/** web's VIBRATE_MS, as the haptic word of about that weight; null is none (web's 0). */
const BUZZ: Readonly<Record<FeedbackCue, keyof typeof haptic | null>> = {
  tap: "select",
  confirm: "tap",
  deny: "error",
  crash: "heavy",
  "swipe-up": "tap",
  "swipe-down": "tap",
  "card-win": "success",
  "card-loss": "error",
  "match-found": "heavy",
  "duel-win": "success",
  "duel-lose": "error",
  click: "select",
  "modal-open": null,
  "modal-close": null,
};

export function fireFeedback(cue: FeedbackCue, opts: { haptics: boolean }): void {
  const sample = SAMPLE[cue];
  if (sample) playSfx(sample);
  const buzz = BUZZ[cue];
  if (buzz && opts.haptics) haptic[buzz]();
}
