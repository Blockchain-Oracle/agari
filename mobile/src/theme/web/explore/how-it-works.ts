import type { ThemeName } from "../../index";

/** web's how-it-works.css `--hiw-*` as computed on useagari.xyz/how-it-works at 402 px, per theme. */
const DARK = {
  mint: "#34D399",
  mintWash: "rgba(52, 211, 153, 0.1)",
  mintEdge: "rgba(52, 211, 153, 0.1)",
  mintTagEdge: "rgba(52, 211, 153, 0.25)",
  blue: "#60A5FA",
  blueWash: "rgba(96, 165, 250, 0.1)",
  blueEdge: "rgba(96, 165, 250, 0.1)",
  card: "rgba(23, 23, 23, 0.5)",
  line: "rgba(255, 255, 255, 0.05)",
  tile: "rgba(255, 255, 255, 0.05)",
  formula: "rgba(0, 0, 0, 0.4)",
  vermilionWash: "rgba(224, 77, 38, 0.1)",
  ctaInk: "#000000",
  ctaGlow: "0px 0px 30px 0px rgba(52, 211, 153, 0.2)",
};

const LIGHT: typeof DARK = {
  mint: "#2E6B4F",
  mintWash: "rgba(46, 107, 79, 0.1)",
  mintEdge: "rgba(46, 107, 79, 0.1)",
  mintTagEdge: "rgba(46, 107, 79, 0.25)",
  blue: "#3E6391",
  blueWash: "rgba(62, 99, 145, 0.1)",
  blueEdge: "rgba(62, 99, 145, 0.1)",
  card: "rgba(251, 247, 238, 0.94)",
  line: "rgba(20, 18, 16, 0.08)",
  tile: "rgba(20, 18, 16, 0.05)",
  formula: "rgba(20, 18, 16, 0.04)",
  vermilionWash: "rgba(217, 62, 31, 0.1)",
  ctaInk: "#F4EEE3",
  ctaGlow: "0px 0px 30px 0px rgba(52, 211, 153, 0.2)",
};

export type HiwTokens = typeof DARK;
export const hiwTokens = (name: ThemeName): HiwTokens => (name === "dark" ? DARK : LIGHT);
