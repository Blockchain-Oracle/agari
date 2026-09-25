import type { ThemeName } from "../../index";

/**
 * web's Room sheet (styles/room.css, room-thread.css, room-switch.css) and its hub trigger (markets-hero.css `.mh-room`),
 * per theme. The sheet follows the theme: the reference's dark radial ground, or Yosuku's light card.
 */
const DARK = {
  /** radial-gradient(130% 90% at 50% -10%, #1a130d, #0d0a08 46%, #080605) */
  sheetStops: ["#1A130D", "#0D0A08", "#080605"] as readonly [string, string, string],
  ink: "#FFFFFF",
  ink90: "rgba(255, 255, 255, 0.9)",
  ink62: "rgba(255, 255, 255, 0.62)",
  ink50: "rgba(255, 255, 255, 0.5)",
  ink45: "rgba(255, 255, 255, 0.45)",
  ink40: "rgba(255, 255, 255, 0.4)",
  ink35: "rgba(255, 255, 255, 0.35)",
  ink10: "rgba(255, 255, 255, 0.1)",
  hairline: "rgba(255, 255, 255, 0.1)",
  rule: "rgba(255, 255, 255, 0.08)",
  inset: "rgba(255, 255, 255, 0.02)",
  lossRule: "rgba(251, 113, 133, 0.22)",
  lossFill: "rgba(251, 113, 133, 0.08)",
  triggerInk: "rgba(255, 255, 255, 0.45)",
  triggerMeta: "rgba(255, 255, 255, 0.2)",
};

const LIGHT: typeof DARK = {
  sheetStops: ["#FFFAF2", "#FFFAF2", "#FFFAF2"],
  ink: "rgb(33, 28, 24)",
  ink90: "rgba(33, 28, 24, 0.9)",
  ink62: "rgba(33, 28, 24, 0.62)",
  ink50: "rgba(33, 28, 24, 0.5)",
  ink45: "rgba(33, 28, 24, 0.45)",
  ink40: "rgba(33, 28, 24, 0.4)",
  ink35: "rgba(33, 28, 24, 0.35)",
  ink10: "rgba(33, 28, 24, 0.1)",
  hairline: "rgba(20, 18, 16, 0.11)",
  rule: "rgba(20, 18, 16, 0.08)",
  inset: "rgba(20, 18, 16, 0.025)",
  lossRule: "rgba(194, 56, 31, 0.22)",
  lossFill: "rgba(194, 56, 31, 0.08)",
  triggerInk: "rgba(20, 18, 16, 0.62)",
  triggerMeta: "rgba(20, 18, 16, 0.4)",
};

/** The vermilion washes the sheet uses in both themes. */
export const ROOM_VERMILION = {
  scrim: "rgba(0, 0, 0, 0.7)",
  glow: "rgba(224, 77, 38, 0.25)",
  hairline: "rgba(224, 77, 38, 0.7)",
  clear: "rgba(224, 77, 38, 0)",
  markBorder: "rgba(224, 77, 38, 0.3)",
  markFill: "rgba(224, 77, 38, 0.08)",
  markGlow: "rgba(224, 77, 38, 0.5)",
  halo: "rgba(224, 77, 38, 0.28)",
  iconBorder: "rgba(224, 77, 38, 0.35)",
  mineBorder: "rgba(224, 77, 38, 0.28)",
  mineFill: "rgba(224, 77, 38, 0.07)",
  switchOn: "rgba(224, 77, 38, 0.16)",
  focus: "rgba(224, 77, 38, 0.45)",
} as const;

export type RoomTokens = typeof DARK;
export const roomTokens = (name: ThemeName): RoomTokens => (name === "dark" ? DARK : LIGHT);

/** `.room-avatar`: the address's hue as a 22 % disc with its ink (lighter on dark, deeper on light). */
export function roomAvatar(name: ThemeName, hue: number): { fill: string; ink: string } {
  return { fill: `hsla(${hue}, 45%, 50%, 0.22)`, ink: name === "dark" ? `hsl(${hue}, 55%, 72%)` : `hsl(${hue}, 60%, 32%)` };
}
