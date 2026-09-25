import type { ThemeName } from "../index";

/**
 * web's `/portfolio/edge` palette (styles/edge.css `.edge-page` --edge-*, per theme) and the fills the CSS computes
 * from it: the page's vermilion glow, the state panel's paper wash and its 80 px rules, the skeleton shimmer.
 */
const DARK = {
  bg: "#090909", surface: "#0E0E0F", surface2: "#141311",
  text: "#F3F0EA", muted: "#A29C92", faint: "#6F6B64",
  rule: "rgba(255, 255, 255, 0.09)", ruleStrong: "rgba(255, 255, 255, 0.16)", paper: "rgba(255, 255, 255, 0.025)", paperClear: "rgba(255, 255, 255, 0)",
  glow: "rgba(214, 75, 38, 0.055)", glowClear: "rgba(214, 75, 38, 0)",
  shimmer: "rgba(255, 255, 255, 0.045)", shimmerClear: "rgba(255, 255, 255, 0)",
  vermilion: "#E04D26", vermilionD: "#B83A1B", actionInk: "#FFFAF4",
};

const LIGHT: typeof DARK = {
  bg: "#F4EEE3", surface: "#FBF7EF", surface2: "#EFE7DA",
  text: "#1A1612", muted: "#6B6359", faint: "#91887A",
  rule: "rgba(38, 30, 24, 0.12)", ruleStrong: "rgba(38, 30, 24, 0.2)", paper: "rgba(255, 255, 255, 0.34)", paperClear: "rgba(255, 255, 255, 0)",
  glow: "rgba(214, 75, 38, 0.055)", glowClear: "rgba(214, 75, 38, 0)",
  shimmer: "rgba(255, 255, 255, 0.045)", shimmerClear: "rgba(255, 255, 255, 0)",
  vermilion: "#D93E1F", vermilionD: "#B83214", actionInk: "#FFFAF4",
};

export type EdgeTokens = typeof DARK;
export const edgeTokens = (name: ThemeName): EdgeTokens => (name === "dark" ? DARK : LIGHT);
