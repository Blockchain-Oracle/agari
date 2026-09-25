import type { ThemeName } from "../index";

/**
 * web's Lucky cabinet as the browser computes it at 402 px, per theme (lucky.css, stage.css `.crt-screen` /
 * `.st-band` / `.st-cadence`, the shadcn secondary chip and BlockedButton). Roles that equal a `useTheme().color`
 * value (surface-1, surface-2, hairline, the grays, vermilion, profit, loss, ground) are read from there.
 */
const DARK = {
  // .lk-face: linear-gradient(180deg, color-mix(white 6%, bg), bg) under the CRT's two inset shadows
  faceGradient: "linear-gradient(180deg, #141414, #050505)",
  faceShadow: "inset 0 0 18px rgba(0, 0, 0, 0.55), inset 0 0 60px rgba(0, 0, 0, 0.35)",
  screw: "rgba(0, 0, 0, 0.5)",
  scanline: "rgba(0, 0, 0, 0.28)",
  // .lk-stake-field and .st-band: color-mix(bg 55%, surface-1)
  well: "#0D0D0D",
  bandShadow: "inset 0 2px 0 rgba(255, 255, 255, 0.06), inset 0 -2px 0 rgba(0, 0, 0, 0.45)",
  // .lk-cta: vermilion with a 60 % vermilion edge and the commit lip
  ctaBorder: "rgba(224, 77, 38, 0.6)",
  ctaShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.28), inset 0 -2px 0 rgba(0, 0, 0, 0.32), 0 2px 0 rgba(0, 0, 0, 0.55)",
  ctaShadowPressed: "inset 0 1px 0 rgba(0, 0, 0, 0.25), inset 0 -1px 0 rgba(255, 255, 255, 0.08)",
  // .lk-section-k: vermilion at 80 %
  sectionK: "rgba(224, 77, 38, 0.8)",
  cadenceBorder: "rgba(255, 255, 255, 0.12)",
  driftBorder: "rgba(224, 77, 38, 0.34)", driftBg: "rgba(224, 77, 38, 0.07)",
  placedBorder: "rgba(52, 211, 153, 0.45)", refusedBorder: "rgba(224, 77, 38, 0.34)",
  // BlockedButton tone up/down and the verdict's cream ink
  toneInk: "#141210",
};

const LIGHT: typeof DARK = {
  faceGradient: "linear-gradient(180deg, #E7E1D6, #F4EEE3)",
  faceShadow: "inset 0 0 18px rgba(20, 18, 16, 0.25), inset 0 0 60px rgba(20, 18, 16, 0.12)",
  screw: "rgba(20, 18, 16, 0.35)",
  scanline: "rgba(0, 0, 0, 0.28)",
  well: "#F5EFE3",
  bandShadow: "inset 0 2px 0 rgba(255, 255, 255, 0.5), inset 0 -2px 0 rgba(20, 18, 16, 0.08)",
  ctaBorder: "rgba(217, 62, 31, 0.6)",
  ctaShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.28), inset 0 -2px 0 rgba(0, 0, 0, 0.32), 0 2px 0 rgba(0, 0, 0, 0.55)",
  ctaShadowPressed: "inset 0 1px 0 rgba(0, 0, 0, 0.25), inset 0 -1px 0 rgba(255, 255, 255, 0.08)",
  sectionK: "rgba(217, 62, 31, 0.8)",
  cadenceBorder: "rgba(20, 18, 16, 0.14)",
  driftBorder: "rgba(217, 62, 31, 0.34)", driftBg: "rgba(217, 62, 31, 0.07)",
  placedBorder: "rgba(46, 107, 79, 0.45)", refusedBorder: "rgba(217, 62, 31, 0.34)",
  toneInk: "#141210",
};

export type LuckyTokens = typeof DARK;
export const luckyTokens = (name: ThemeName): LuckyTokens => (name === "dark" ? DARK : LIGHT);
