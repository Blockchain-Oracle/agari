import type { ThemeName } from "../../index";

/** web's status.css as computed on useagari.xyz/status at 402 px, per theme (amber is the reference's literal in both). */
const DARK = {
  amber: "#FBBF24",
  amberWash: "rgba(251, 191, 36, 0.1)",
  amberBorder: "rgba(251, 191, 36, 0.2)",
  amberBannerFill: "rgba(251, 191, 36, 0.04)",
  profitBannerFill: "rgba(52, 211, 153, 0.04)",
  profitBannerBorder: "rgba(52, 211, 153, 0.2)",
  hairline: "rgba(255, 255, 255, 0.08)",
  rule: "rgba(255, 255, 255, 0.05)",
  hover: "rgba(255, 255, 255, 0.02)",
};

const LIGHT: typeof DARK = {
  amber: "#FBBF24",
  amberWash: "rgba(251, 191, 36, 0.1)",
  amberBorder: "rgba(251, 191, 36, 0.2)",
  amberBannerFill: "rgba(251, 191, 36, 0.04)",
  profitBannerFill: "rgba(46, 107, 79, 0.04)",
  profitBannerBorder: "rgba(46, 107, 79, 0.2)",
  hairline: "rgba(20, 18, 16, 0.09)",
  rule: "rgba(20, 18, 16, 0.07)",
  hover: "rgba(20, 18, 16, 0.03)",
};

export type StatusTokens = typeof DARK;
export const statusTokens = (name: ThemeName): StatusTokens => (name === "dark" ? DARK : LIGHT);
