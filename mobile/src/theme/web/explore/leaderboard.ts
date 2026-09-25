import type { ThemeName } from "../../index";

/**
 * `/leaderboard` as web computes it at 402 px: yosuku part-08/09 (podium, rows, you bar), part-15's phone
 * rules and leaderboard-theme.css's light twins, which win over part-17 on production. The phone board (owner's
 * mobile-first pass) adds part-08's `.pill-tabs` segment, chip rings, the pedestals and the win-rate track.
 */
const DARK = {
  // .podium-spot
  spotBorder: "rgba(255, 255, 255, 0.08)",
  spotFill: "rgba(255, 255, 255, 0.012)",
  firstBorder: "rgba(224, 77, 38, 0.3)",
  firstOrdInk: "#FFFFFF",
  // .podium-portrait's ring
  portraitBorder: "rgba(255, 255, 255, 0.12)",
  // .banzuke-row, as the phone list's rows
  rowBorder: "rgba(255, 255, 255, 0.04)",
  rowPressed: "rgba(255, 255, 255, 0.02)",
  // .you-bar
  youInk: "#FFFFFF",
  youSoft: "rgba(255, 255, 255, 0.7)",
  youShadow: "rgba(224, 77, 38, 0.4)",
  youPortraitFill: "rgba(0, 0, 0, 0.3)",
  youPortraitBorder: "rgba(255, 255, 255, 0.6)",
  youPortraitInk: "rgba(255, 255, 255, 0.68)",
  youCtaFill: "#FFFFFF",
  // part-08 .pill-tabs / .pill-tab.active
  segFill: "rgba(255, 255, 255, 0.03)",
  segBorder: "rgba(255, 255, 255, 0.06)",
  segActiveFill: "#FFFFFF",
  segActiveInk: "#000000",
  chipBorder: "rgba(255, 255, 255, 0.1)",
  barTrack: "rgba(255, 255, 255, 0.06)",
  stickyRule: "rgba(255, 255, 255, 0.06)",
};

const LIGHT: typeof DARK = {
  spotBorder: "rgba(20, 18, 16, 0.11)",
  spotFill: "rgba(20, 18, 16, 0.02)",
  firstBorder: "rgba(224, 77, 38, 0.3)",
  firstOrdInk: "#141210",
  portraitBorder: "rgba(20, 18, 16, 0.16)",
  rowBorder: "rgba(20, 18, 16, 0.07)",
  rowPressed: "rgba(20, 18, 16, 0.03)",
  youInk: "#FBF7EE",
  youSoft: "rgba(255, 255, 255, 0.7)",
  youShadow: "rgba(224, 77, 38, 0.4)",
  youPortraitFill: "rgba(0, 0, 0, 0.3)",
  youPortraitBorder: "rgba(255, 255, 255, 0.6)",
  youPortraitInk: "rgba(255, 255, 255, 0.68)",
  youCtaFill: "#FBF7EE",
  segFill: "rgba(20, 18, 16, 0.03)",
  segBorder: "rgba(20, 18, 16, 0.07)",
  segActiveFill: "#141210",
  segActiveInk: "#F4EEE3",
  chipBorder: "rgba(20, 18, 16, 0.12)",
  barTrack: "rgba(20, 18, 16, 0.08)",
  stickyRule: "rgba(20, 18, 16, 0.07)",
};

export type LeaderboardTokens = typeof DARK;
export const leaderboardTokens = (name: ThemeName): LeaderboardTokens => (name === "dark" ? DARK : LIGHT);
