import type { ThemeName } from "../../index";

/**
 * web's /u/[address] on a phone as useagari.xyz computes it, per theme: profile.css (the /news frame and the edge
 * excerpt's own ladder), history.css (the summary, reputation plate, badges, bets plate) and the outline button.
 */
const DARK = {
  barRule: "rgba(255, 255, 255, 0.12)",
  avatarRing: "rgba(255, 255, 255, 0.12)",
  plate: "#171717",
  plateBorder: "rgba(255, 255, 255, 0.1)",
  csvFill: "rgba(255, 255, 255, 0.03)",
  track: "rgba(255, 255, 255, 0.06)",
  badgeGround: "#050505",
  rankFill: "rgba(255, 255, 255, 0.02)",
  earnedFill: "rgba(224, 77, 38, 0.06)",
  earnedBorder: "rgba(224, 77, 38, 0.3)",
  iconFill: "rgba(224, 77, 38, 0.08)",
  iconBorder: "rgba(224, 77, 38, 0.35)",
  lockedFill: "rgba(255, 255, 255, 0.018)",
  lockedOpacity: 0.45,
  equityZero: "rgba(255, 255, 255, 0.16)",
  equityDown: "rgba(255, 255, 255, 0.55)",
  equityEmptyBorder: "rgba(255, 255, 255, 0.06)",
  equityEmptyFill: "rgba(255, 255, 255, 0.015)",
  equityEmptyInk: "rgba(255, 255, 255, 0.25)",
  edgeText: "#F3F0EA",
  edgeMuted: "#A29C92",
  edgeFaint: "#6F6B64",
  edgeRule: "rgba(255, 255, 255, 0.09)",
  edgePaper: "rgba(255, 255, 255, 0.025)",
};

const LIGHT: typeof DARK = {
  barRule: "rgba(20, 18, 16, 0.12)",
  avatarRing: "rgba(20, 18, 16, 0.12)",
  plate: "#F6F0E4",
  plateBorder: "rgba(20, 18, 16, 0.12)",
  csvFill: "rgba(20, 18, 16, 0.036)",
  track: "rgba(20, 18, 16, 0.08)",
  badgeGround: "#F4EEE3",
  rankFill: "rgba(20, 18, 16, 0.03)",
  earnedFill: "rgba(224, 77, 38, 0.06)",
  earnedBorder: "rgba(224, 77, 38, 0.3)",
  iconFill: "rgba(224, 77, 38, 0.08)",
  iconBorder: "rgba(224, 77, 38, 0.35)",
  lockedFill: "rgba(20, 18, 16, 0.02)",
  lockedOpacity: 0.55,
  equityZero: "rgba(20, 18, 16, 0.22)",
  equityDown: "rgba(20, 18, 16, 0.62)",
  equityEmptyBorder: "rgba(20, 18, 16, 0.07)",
  equityEmptyFill: "rgba(20, 18, 16, 0.02)",
  equityEmptyInk: "rgba(20, 18, 16, 0.5)",
  edgeText: "#1A1612",
  edgeMuted: "#6B6359",
  edgeFaint: "#91887A",
  edgeRule: "rgba(38, 30, 24, 0.12)",
  edgePaper: "rgba(255, 255, 255, 0.34)",
};

export type ProfileTokens = typeof DARK;
export const profileTokens = (name: ThemeName): ProfileTokens => (name === "dark" ? DARK : LIGHT);
