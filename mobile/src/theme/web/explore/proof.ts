import type { ThemeName } from "../../index";

/**
 * web's proof-feed.css and the cream receipt (components/receipt) as computed on useagari.xyz/proof and
 * /proof/<market> at 402 px, per theme. The table frame reuses `statusTokens` (the page is Masayume's /status frame).
 */
const DARK = {
  /** --gray-700: the void pill's border and the source link's dotted underline. */
  gray700: "#404040",
  /** text-cream-ink/70 and /80 on the paper (the paper is cream in both themes). */
  creamInk70: "rgba(20, 18, 16, 0.7)",
  creamInk80: "rgba(20, 18, 16, 0.8)",
  /** --receipt-shadow's heavier layer (0 18px 40px -18px rgb(0 0 0 / 0.6)). */
  receiptShadow: "#000000",
};

const LIGHT: typeof DARK = {
  gray700: "#C4BAA6",
  creamInk70: "rgba(20, 18, 16, 0.7)",
  creamInk80: "rgba(20, 18, 16, 0.8)",
  receiptShadow: "#000000",
};

export type ProofTokens = typeof DARK;
export const proofTokens = (name: ThemeName): ProofTokens => (name === "dark" ? DARK : LIGHT);
