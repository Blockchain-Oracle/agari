import type { ArcadePalette, Rgb } from "@/features/games/arcade/palette";
import { DARK } from "~/theme/palette";

/**
 * web's `arcade/palette.ts` source on the phone. Web reads the screen's colours off `.ar-screen`, which
 * re-declares the DARK theme's own values whatever the page wears (the island stays dark); here they come
 * straight from the dark palette tokens, so the draw modules get the same triplets.
 */
function triplet(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export const ARCADE_PALETTE: ArcadePalette = {
  ground: triplet(DARK.ground),
  ink: triplet(DARK.ink),
  up: triplet(DARK.profit),
  down: triplet(DARK.loss),
  accent: triplet(DARK.accent),
};

/** The island's colours as tokens for the native HUD and plates drawn over it. */
export const ISLAND = {
  ground: DARK.ground,
  /** web's plate ground: the island at 90 % (`rgb(var(--ar-ground-rgb) / 0.9)`), as an 8-digit hex. */
  veil: `${DARK.ground}E6`,
  ink: DARK.ink,
  inkSoft: DARK.inkSecondary,
  inkMuted: DARK.inkMuted,
  accent: DARK.accent,
  loss: DARK.loss,
  hairline: DARK.hairline,
  screw: DARK.borderStrong,
  onAccent: DARK.onAccent,
} as const;
