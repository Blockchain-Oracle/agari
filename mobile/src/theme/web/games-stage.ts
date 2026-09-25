import type { ThemeName } from "../index";

/**
 * web's swipe stage and Practice at 402 px, per theme (stage.css, practice.css), as the browser computes them.
 * Light keeps what the cascade actually produces: the active pip stays the resting step (the light `.st-pip`
 * override out-ranks `--active`), and the card is `#FFFDF8` on a 9 % hairline.
 */
const DARK = {
  cardBg: "#171717", cardBorder: "rgba(255, 255, 255, 0.1)",
  bandBg: "#0D0D0D", bandBorder: "rgba(255, 255, 255, 0.1)", bandLipTop: "rgba(255, 255, 255, 0.06)", bandLipBottom: "rgba(0, 0, 0, 0.45)",
  callLipTop: "rgba(255, 255, 255, 0.06)", callLipBottom: "rgba(0, 0, 0, 0.35)",
  pip: "rgba(255, 255, 255, 0.14)", pipActive: "#E04D26",
  cadenceBorder: "rgba(255, 255, 255, 0.12)", discGeneric: "rgba(255, 255, 255, 0.14)",
  artGleam: "rgba(255, 255, 255, 0.06)", artVignetteNear: "rgba(0, 0, 0, 0.55)", artVignetteFar: "rgba(0, 0, 0, 0.35)",
  scanline: "rgba(0, 0, 0, 0.28)", flicker: "rgba(18, 16, 16, 0.12)", screw: "rgba(0, 0, 0, 0.5)", artGlow: "rgba(224, 77, 38, 0.6)",
  quoteInset: "rgba(255, 255, 255, 0.08)", eyebrow: "rgba(224, 77, 38, 0.8)",
  tintUp: "rgba(52, 211, 153, 0.25)", tintDown: "rgba(251, 113, 133, 0.25)",
  stampBg: "rgba(5, 5, 5, 0.8)", stampShadow: "rgba(0, 0, 0, 0.6)",
  deplete: "rgba(255, 255, 255, 0.1)", emptyBorder: "rgba(255, 255, 255, 0.12)",
  refusalBorder: "rgba(224, 77, 38, 0.34)", refusalBg: "rgba(224, 77, 38, 0.07)",
  // practice.css
  tutorialBorder: "rgba(224, 77, 38, 0.32)", tutorialBg: "rgba(224, 77, 38, 0.06)", watchBar: "rgba(255, 255, 255, 0.12)",
  scoreBg: "rgba(23, 23, 23, 0.5)", scoreWon: "rgba(52, 211, 153, 0.4)", scoreLost: "rgba(251, 113, 133, 0.34)",
};

const LIGHT: typeof DARK = {
  cardBg: "#FFFDF8", cardBorder: "rgba(20, 18, 16, 0.09)",
  bandBg: "#F5EFE3", bandBorder: "rgba(20, 18, 16, 0.12)", bandLipTop: "rgba(255, 255, 255, 0.5)", bandLipBottom: "rgba(20, 18, 16, 0.08)",
  callLipTop: "rgba(255, 255, 255, 0.06)", callLipBottom: "rgba(0, 0, 0, 0.35)",
  pip: "rgba(20, 18, 16, 0.14)", pipActive: "rgba(20, 18, 16, 0.14)",
  cadenceBorder: "rgba(20, 18, 16, 0.14)", discGeneric: "rgba(20, 18, 16, 0.12)",
  artGleam: "rgba(255, 255, 255, 0.06)", artVignetteNear: "rgba(20, 18, 16, 0.25)", artVignetteFar: "rgba(20, 18, 16, 0.12)",
  scanline: "rgba(0, 0, 0, 0.28)", flicker: "rgba(18, 16, 16, 0.12)", screw: "rgba(20, 18, 16, 0.35)", artGlow: "rgba(217, 62, 31, 0.6)",
  quoteInset: "rgba(20, 18, 16, 0.08)", eyebrow: "rgba(217, 62, 31, 0.8)",
  tintUp: "rgba(46, 107, 79, 0.25)", tintDown: "rgba(194, 56, 31, 0.25)",
  stampBg: "rgba(244, 238, 227, 0.8)", stampShadow: "rgba(0, 0, 0, 0.6)",
  deplete: "rgba(20, 18, 16, 0.12)", emptyBorder: "rgba(20, 18, 16, 0.14)",
  refusalBorder: "rgba(217, 62, 31, 0.34)", refusalBg: "rgba(217, 62, 31, 0.07)",
  tutorialBorder: "rgba(217, 62, 31, 0.32)", tutorialBg: "rgba(217, 62, 31, 0.06)", watchBar: "rgba(20, 18, 16, 0.12)",
  scoreBg: "rgba(251, 247, 238, 0.96)", scoreWon: "rgba(46, 107, 79, 0.4)", scoreLost: "rgba(194, 56, 31, 0.34)",
};

export type StageTokens = typeof DARK;
export const stageTokens = (name: ThemeName): StageTokens => (name === "dark" ? DARK : LIGHT);
