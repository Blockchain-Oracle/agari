import type { ThemeName } from "../index";

/**
 * web's duel at 402 px, per theme (duel.css): the tier choice, the searching plate and its breath, the spinner, the
 * settled-card washes, the verdict edges, the ladder's medals and prize chips, the result modal's stat wells. The
 * plates themselves are surface-1 on the hairline, read from `useTheme().color`.
 */
const DARK = {
  tierOnBg: "rgba(224, 77, 38, 0.08)",
  searchingBorder: "rgba(224, 77, 38, 0.35)", searchingBorderPeak: "rgba(224, 77, 38, 0.7)", searchingBg: "rgba(224, 77, 38, 0.06)", searchingGlow: "rgba(224, 77, 38, 0.22)",
  spinnerTrack: "rgba(224, 77, 38, 0.3)",
  errorBorder: "rgba(224, 77, 38, 0.34)", refusalBorder: "rgba(224, 77, 38, 0.34)", refusalBg: "rgba(224, 77, 38, 0.07)",
  verdictWon: "rgba(52, 211, 153, 0.45)", verdictLost: "rgba(251, 113, 133, 0.4)",
  liveGlow: "rgba(224, 77, 38, 1)",
  medal1: "#E56846", medal2: "#D5D5D5", medal3: "#A46250", medalInk: "#050505", medal3Ink: "#FFFFFF",
  chipBorder: "rgba(255, 255, 255, 0.12)", chipBg: "rgba(255, 255, 255, 0.05)", chipOnBorder: "rgba(224, 77, 38, 0.45)", chipOnBg: "rgba(224, 77, 38, 0.14)",
  statBg: "rgba(0, 0, 0, 0.3)", lockedGlow: "rgba(224, 77, 38, 0.55)",
};

const LIGHT: typeof DARK = {
  tierOnBg: "rgba(217, 62, 31, 0.08)",
  searchingBorder: "rgba(217, 62, 31, 0.35)", searchingBorderPeak: "rgba(217, 62, 31, 0.7)", searchingBg: "rgba(217, 62, 31, 0.06)", searchingGlow: "rgba(217, 62, 31, 0.22)",
  spinnerTrack: "rgba(217, 62, 31, 0.3)",
  errorBorder: "rgba(217, 62, 31, 0.34)", refusalBorder: "rgba(217, 62, 31, 0.34)", refusalBg: "rgba(217, 62, 31, 0.07)",
  verdictWon: "rgba(46, 107, 79, 0.45)", verdictLost: "rgba(194, 56, 31, 0.4)",
  liveGlow: "rgba(217, 62, 31, 1)",
  medal1: "#BB371D", medal2: "#332F2A", medal3: "#A65C46", medalInk: "#F4EEE3", medal3Ink: "#141210",
  chipBorder: "rgba(20, 18, 16, 0.12)", chipBg: "rgba(20, 18, 16, 0.04)", chipOnBorder: "rgba(217, 62, 31, 0.45)", chipOnBg: "rgba(217, 62, 31, 0.14)",
  statBg: "rgba(20, 18, 16, 0.06)", lockedGlow: "rgba(217, 62, 31, 0.55)",
};

export type DuelTokens = typeof DARK;
export const duelTokens = (name: ThemeName): DuelTokens => (name === "dark" ? DARK : LIGHT);
