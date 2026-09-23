import type { ArcadeGame } from "@agari/core/games/arcade";

/**
 * The few words the phone says differently from web's `arcade/copy.ts` (everything else is web's copy, imported).
 * Web's control hints name what a browser listens to (drag, scroll wheel, arrow keys, Space); these name what this
 * build listens to: a finger on the screen.
 */
export const ARCADE_NATIVE = {
  control: {
    "line-rider": "Touch the screen and drag up or down: the dot follows your finger",
    "candle-hop": "Tap anywhere on the screen to hop",
  } satisfies Record<ArcadeGame, string>,
  calmA11y: "Calmer ramp",
  stageA11y: {
    "line-rider": "Line Rider field. Touch and drag up or down to steer the dot.",
    "candle-hop": "Candle Hop field. Tap to hop.",
  } satisfies Record<ArcadeGame, string>,
} as const;
