import type { ThemeName } from "../../index";

/**
 * web's `/trade-from-x` island as the browser computes it at 402 px (useagari.xyz): x.css `.xt-*`, x-instruction.css
 * `.xi-*`, x-card.css `.xt .xw` and yosuku part-17.css. The page is `data-theme="dark"` in both themes — web's one
 * dark island — so both token sets are the same; only web's shared Connect button follows the theme (its accent comes
 * from `useTheme().color.accent`).
 */
const DARK = {
  /* --xt-* (x.css .xt-page) */
  v: "#E04D26",
  m: "#34D399",
  ink: "#F3F1EE",
  bg: "#08080B",
  paper: "#0E0E12",
  agent: "#120D0C",
  mintPaper: "#0B1210",
  seal: "#140C0B",
  wire: "#CFCBC4",
  muted: "#7C7770",
  faint: "#8A847D",
  sealText: "#9A8D87",
  mintInk: "#DDFFEE",
  white: "#FFFFFF",
  /* tailwind grays the island names */
  gray200: "#E5E5E5",
  gray300: "#D4D4D4",
  gray400: "#A3A3A3",
  gray500: "#737373",
  gray600: "#525252",
  gray700: "#404040",
  clear: "rgba(0, 0, 0, 0)",
  /* .xt-strip */
  stripBg: "rgba(8, 8, 11, 0.7)",
  stripBorder: "rgba(255, 255, 255, 0.06)",
  eyebrow: "rgba(224, 77, 38, 0.8)",
  /* .xt-rail */
  railBorder: "rgba(255, 255, 255, 0.08)",
  railTop: "rgba(255, 255, 255, 0.03)",
  railPaperStroke: "rgba(255, 255, 255, 0.14)",
  railYouStroke: "rgba(255, 255, 255, 0.16)",
  /* .xt-step-node / .xt-spine / .xt-step-card */
  nodeBorder: "rgba(255, 255, 255, 0.12)",
  nodeBg: "rgba(255, 255, 255, 0.03)",
  nodeDoneBg: "rgba(52, 211, 153, 0.15)",
  nodeDoneBorder: "rgba(52, 211, 153, 0.45)",
  nodeActiveBg: "rgba(224, 77, 38, 0.15)",
  nodeActiveBorder: "rgba(224, 77, 38, 0.55)",
  pulse: "rgba(224, 77, 38, 0.3)",
  spine: "rgba(224, 77, 38, 0.12)",
  cardBorder: "rgba(255, 255, 255, 0.07)",
  cardBg: "rgba(255, 255, 255, 0.02)",
  cardDoneBorder: "rgba(52, 211, 153, 0.22)",
  cardDoneBg: "rgba(52, 211, 153, 0.025)",
  cardActiveBorder: "rgba(224, 77, 38, 0.25)",
  cardActiveBg: "rgba(224, 77, 38, 0.03)",
  /* .xt-chip */
  chipBorder: "rgba(52, 211, 153, 0.25)",
  chipBg: "rgba(52, 211, 153, 0.04)",
  /* .xt-err */
  errBorder: "rgba(244, 63, 94, 0.3)",
  errBg: "rgba(244, 63, 94, 0.06)",
  errInk: "#FDA4AF",
  warnInk: "#FBBF24",
  /* the capability receipt */
  amountBorder: "rgba(255, 255, 255, 0.12)",
  amountFocus: "rgba(255, 255, 255, 0.3)",
  presetBorder: "rgba(255, 255, 255, 0.1)",
  canBorder: "rgba(52, 211, 153, 0.2)",
  canBg: "rgba(52, 211, 153, 0.03)",
  canHead: "rgba(52, 211, 153, 0.8)",
  cannotBorder: "rgba(224, 77, 38, 0.2)",
  cannotBg: "rgba(224, 77, 38, 0.03)",
  cannotHead: "rgba(224, 77, 38, 0.8)",
  struck: "rgba(224, 77, 38, 0.5)",
  lineBorder: "rgba(255, 255, 255, 0.1)",
  lineBg: "rgba(0, 0, 0, 0.3)",
  /* .xt-composer--live */
  liveBorder: "rgba(52, 211, 153, 0.25)",
  liveBg: "rgba(52, 211, 153, 0.03)",
  /* .xt .xw (x-card.css): the permission panel */
  xwLine: "rgba(255, 255, 255, 0.14)",
  xwActionBg: "rgba(224, 77, 38, 0.06)",
  xwBtnBorder: "rgba(224, 77, 38, 0.45)",
  /* .xi (x-instruction.css) */
  xiMute: "#AAA49B",
  xiLine: "rgba(255, 255, 255, 0.13)",
  xiUp: "#6EE7B7",
  xiDown: "#F99B8B",
  xiUpWash: "rgba(110, 231, 183, 0.1)",
  xiUpBorder: "rgba(110, 231, 183, 0.48)",
  xiDownWash: "rgba(249, 155, 139, 0.1)",
  xiDownBorder: "rgba(249, 155, 139, 0.48)",
  xiAssetOn: "#EDE8DF",
  xiAssetOnInk: "#1A1612",
  xiCadenceOn: "rgba(224, 77, 38, 0.1)",
  xiHover: "rgba(255, 255, 255, 0.06)",
  xiAmountBg: "rgba(255, 255, 255, 0.024)",
  xiQuickOn: "rgba(255, 255, 255, 0.08)",
  xiPost: "#F3EEE5",
  xiPostInk: "#1A1612",
  xiPostMute: "#766E63",
  xiCmdUp: "#246449",
  xiCmdDown: "#A03626",
  xiCopy: "#CC4521",
  xiCopyInk: "#FFFAF3",
  xiCopyPressed: "#B83E1E",
  xiCopyOffBg: "#E1DACF",
  xiCopyOffBorder: "#D0C6B8",
  xiCopyOffInk: "#786E60",
  xiSetup: "#6B6052",
};

const LIGHT: typeof DARK = DARK;

export type TradeXTokens = typeof DARK;
export const tradeXTokens = (name: ThemeName): TradeXTokens => (name === "dark" ? DARK : LIGHT);

/** An "#rrggbb" string → its channels; null when it is not one (web's CSS drops such a colour). */
export function hexChannels(value: string): [number, number, number] | null {
  const match = /^#?([0-9a-fA-F]{6})$/.exec(value);
  if (!match) return null;
  const n = parseInt(match[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Linear mix of two "#rrggbb" colours, as a CSS rgb() string (for the identity orb's conic stops). */
export function mixHex(a: string, b: string, t: number): string {
  const ca = hexChannels(a);
  const cb = hexChannels(b);
  if (!ca || !cb) return DARK.clear;
  const c = ca.map((x, i) => Math.round(x + (cb[i] - x) * t));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}
