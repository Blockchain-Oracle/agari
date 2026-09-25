import type { ThemeName } from "../../index";

/** web's demo.css / demo-sections.css as computed on useagari.xyz/demo at 402 px, per theme (`--demo-*`). */
const DARK = {
  hair06: "rgba(255, 255, 255, 0.06)",
  hair08: "rgba(255, 255, 255, 0.08)",
  hair10: "rgba(255, 255, 255, 0.1)",
  hair15: "rgba(255, 255, 255, 0.15)",
  wash: "rgba(255, 255, 255, 0.04)",
  washEnd: "rgba(255, 255, 255, 0)",
  frameShadow: "0px 40px 120px -40px rgba(0, 0, 0, 0.9)",
  /** color-mix(var(--bg) 70%, transparent) under the sticky bar's blur. */
  barBg: "rgba(5, 5, 5, 0.7)",
  eyebrow: "rgba(224, 77, 38, 0.8)",
  tractionDot: "rgba(224, 77, 38, 0.5)",
  /** The embed's own ground (`.demo-video-figure .demo-video`), literal in both themes. */
  videoGround: "#050505",
  /** YouTube's play button on the embed's poster. */
  youtubeRed: "#FF0033",
  youtubeGlyph: "#FFFFFF",
};

const LIGHT: typeof DARK = {
  hair06: "rgba(20, 18, 16, 0.07)",
  hair08: "rgba(20, 18, 16, 0.11)",
  hair10: "rgba(20, 18, 16, 0.11)",
  hair15: "rgba(20, 18, 16, 0.16)",
  wash: "rgba(20, 18, 16, 0.03)",
  washEnd: "rgba(20, 18, 16, 0)",
  frameShadow: "0px 40px 120px -50px rgba(80, 45, 24, 0.5)",
  barBg: "rgba(244, 238, 227, 0.7)",
  eyebrow: "rgba(217, 62, 31, 0.8)",
  tractionDot: "rgba(217, 62, 31, 0.5)",
  videoGround: "#050505",
  youtubeRed: "#FF0033",
  youtubeGlyph: "#FFFFFF",
};

export type DemoTokens = typeof DARK;
export const demoTokens = (name: ThemeName): DemoTokens => (name === "dark" ? DARK : LIGHT);
