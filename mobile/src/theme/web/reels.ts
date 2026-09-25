import type { ViewStyle } from "react-native";
import type { ThemeName } from "../index";

/** RN renders both of web's grain blends natively (iOS / new architecture). */
type Blend = NonNullable<ViewStyle["mixBlendMode"]>;

/**
 * web's /reels as the browser computes it at 402 px, per theme (styles/reel.css, reel-theme.css, reel-chrome.css,
 * take.css, hedge.css `.hc-*`, take-cashtag.css). The card follows the theme through one ink triplet — white on
 * dark, #211c18 on cream — and every step on it is that ink at the reference's own alpha.
 */
function ink(rgb: string) {
  const a = (alpha: number) => `rgba(${rgb}, ${alpha})`;
  return {
    ink: `rgb(${rgb})`,
    ink85: a(0.85), ink80: a(0.8), ink70: a(0.7), ink65: a(0.65), ink45: a(0.45), ink40: a(0.4), ink35: a(0.35), ink30: a(0.3),
    ink25: a(0.25), ink15: a(0.15), ink12: a(0.12), ink10: a(0.1), ink08: a(0.08), ink02: a(0.02),
  };
}

const DARK = {
  ...ink("255, 255, 255"),
  vermilion: "#E04D26",
  surface: "radial-gradient(130% 80% at 50% -8%, #16110d 0%, #0c0a08 44%, #080605 100%)",
  surfaceFlat: "#0a0807",
  shadow: "0px 30px 120px -30px rgba(0, 0, 0, 0.9)",
  heat: "linear-gradient(to right, rgba(224, 77, 38, 0), rgba(224, 77, 38, 0.5), rgba(224, 77, 38, 0))",
  grainBlend: "overlay" as Blend,
  // vermilion steps (color-mix over transparent)
  v60: "rgba(224, 77, 38, 0.6)", v50: "rgba(224, 77, 38, 0.5)", v45: "rgba(224, 77, 38, 0.45)", v40: "rgba(224, 77, 38, 0.4)",
  v25: "rgba(224, 77, 38, 0.25)", v10: "rgba(224, 77, 38, 0.1)", v08: "rgba(224, 77, 38, 0.08)", v05: "rgba(224, 77, 38, 0.05)",
  // the floating take pill and the swipe hint: white ink on vermilion in both themes, a fixed vermilion glow
  onVermilion: "#FFFFFF",
  takeShadow: "0px 12px 32px -10px rgba(224, 77, 38, 0.55)",
  hintShadow: "0px 8px 24px -8px rgba(224, 77, 38, 0.7)",
  // desk outcome tones (desk.css .dk-outcome)
  warning: "#F2994A",
};

const LIGHT: typeof DARK = {
  ...ink("33, 28, 24"),
  vermilion: "#D93E1F",
  surface: "radial-gradient(130% 80% at 50% -8%, #fffaf2 0%, #fdf8ef 44%, #f9f3e9 100%)",
  surfaceFlat: "#fffaf2",
  shadow: "inset 0px 1px 0px rgba(255, 255, 255, 0.7), 0px 30px 90px -50px rgba(80, 45, 24, 0.45)",
  heat: "linear-gradient(to right, rgba(217, 62, 31, 0), rgba(217, 62, 31, 0.5), rgba(217, 62, 31, 0))",
  grainBlend: "soft-light" as Blend,
  v60: "rgba(217, 62, 31, 0.6)", v50: "rgba(217, 62, 31, 0.5)", v45: "rgba(217, 62, 31, 0.45)", v40: "rgba(217, 62, 31, 0.4)",
  v25: "rgba(217, 62, 31, 0.25)", v10: "rgba(217, 62, 31, 0.1)", v08: "rgba(217, 62, 31, 0.08)", v05: "rgba(217, 62, 31, 0.05)",
  onVermilion: "#FFFFFF",
  takeShadow: "0px 12px 32px -10px rgba(224, 77, 38, 0.55)",
  hintShadow: "0px 8px 24px -8px rgba(224, 77, 38, 0.7)",
  warning: "#F2994A",
};

export type ReelTokens = typeof DARK;
export const reelTokens = (name: ThemeName): ReelTokens => (name === "dark" ? DARK : LIGHT);

/** A take author's avatar (take.css `.take-avatar`): hsl(h 55% 55%) → hsl(h+40 45% 28%), lit from the top left. */
export const takeAvatar = (hue: number): string =>
  `radial-gradient(120% 120% at 30% 20%, hsl(${hue}, 55%, 55%), hsl(${hue + 40}, 45%, 28%))`;

/** reel.css `.reel-grain`: the fractalNoise tile, white at up to half alpha, drawn at 5 %. */
export const REEL_GRAIN = require("../../../assets/images/reel-grain.png");
