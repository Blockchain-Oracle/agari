import type { ThemeName } from "../../index";

/**
 * `/stats` (and the leaderboard's Live activity, which carries the same card) as web computes it at 402 px:
 * web/src/styles/stats.css --stats-* per theme, the emerald mixes of --profit, and part-04's page-hero chrome.
 */
const DARK = {
  card: "#0D0D10",
  cardTop: "#0E1310",
  hairline: "rgba(255, 255, 255, 0.07)",
  divider: "rgba(255, 255, 255, 0.05)",
  grid: "rgba(255, 255, 255, 0.04)",
  rowPressed: "rgba(255, 255, 255, 0.02)",
  /** --profit at 25 / 7 / 5 / 80 / 35 %. */
  profitBorder: "rgba(52, 211, 153, 0.25)",
  profitFill7: "rgba(52, 211, 153, 0.07)",
  profitFill5: "rgba(52, 211, 153, 0.05)",
  profitInk80: "rgba(52, 211, 153, 0.8)",
  profitGlow: "rgba(52, 211, 153, 0.35)",
  profitClear: "rgba(52, 211, 153, 0)",
  /** --gray-700: the eyebrow's dash. */
  dash: "#404040",
  /** part-04 .crop and .page-hero's bottom rule (literal white mixes, unthemed on web). */
  crop: "rgba(255, 255, 255, 0.18)",
  pageRule: "rgba(255, 255, 255, 0.06)",
  /** pulseDot's ring. */
  dotRing: "rgba(224, 77, 38, 0.45)",
};

const LIGHT: typeof DARK = {
  card: "#FFFAF2",
  cardTop: "#F4FAF5",
  hairline: "rgba(33, 28, 24, 0.11)",
  divider: "rgba(33, 28, 24, 0.08)",
  grid: "rgba(33, 28, 24, 0.06)",
  rowPressed: "rgba(33, 28, 24, 0.03)",
  profitBorder: "rgba(46, 107, 79, 0.25)",
  profitFill7: "rgba(46, 107, 79, 0.07)",
  profitFill5: "rgba(46, 107, 79, 0.05)",
  profitInk80: "rgba(46, 107, 79, 0.8)",
  profitGlow: "rgba(46, 107, 79, 0.35)",
  profitClear: "rgba(46, 107, 79, 0)",
  dash: "#C4BAA6",
  crop: "rgba(255, 255, 255, 0.18)",
  pageRule: "rgba(255, 255, 255, 0.06)",
  dotRing: "rgba(224, 77, 38, 0.45)",
};

export type StatsTokens = typeof DARK;
export const statsTokens = (name: ThemeName): StatsTokens => (name === "dark" ? DARK : LIGHT);
