import type { ThemeName } from "../index";

/**
 * web's take composer (styles/take-composer.css, take.css `.take-chip`) as computed at 402 px. The sheet shares the
 * Room's surface (`--room-*`, room.css), so its ground stops come from `roomTokens`; these are the ink steps over it.
 */
const ink = (rgb: string) => (a: number) => `rgba(${rgb}, ${a})`;
const d = ink("255, 255, 255");
const l = ink("33, 28, 24");

const make = (i: (a: number) => string, hairline: string, inset: string, vermilion: string) => ({
  ink: i(1), ink85: i(0.85), ink65: i(0.65), ink50: i(0.5), ink40: i(0.4), ink35: i(0.35), ink30: i(0.3), ink25: i(0.25), ink12: i(0.12),
  ink06: i(0.06), ink05: i(0.05), ink015: i(0.015),
  hairline, inset,
  sideOnBorder: `rgba(${vermilion}, 0.7)`, sideOnFill: `rgba(${vermilion}, 0.08)`,
  chipBorder: `rgba(${vermilion}, 0.25)`, chipFill: `rgba(${vermilion}, 0.05)`,
  topLine: `rgba(${vermilion}, 0.6)`, topClear: `rgba(${vermilion}, 0)`,
  scrim: "rgba(0, 0, 0, 0.7)", postInk: "#FFFFFF",
});

const DARK = make(d, "rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.02)", "224, 77, 38");
const LIGHT: typeof DARK = make(l, "rgba(20, 18, 16, 0.11)", "rgba(20, 18, 16, 0.025)", "217, 62, 31");

export type TakesTokens = typeof DARK;
export const takesTokens = (name: ThemeName): TakesTokens => (name === "dark" ? DARK : LIGHT);
