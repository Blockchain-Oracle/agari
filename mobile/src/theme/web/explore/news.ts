import type { ThemeName } from "../../index";

/** web's /news on a phone (news.css `.news-page` ladder, news-wire.css), as useagari.xyz computes it per theme. */
const DARK = {
  hairline: "rgba(255, 255, 255, 0.12)",
  rule: "rgba(255, 255, 255, 0.06)",
  bone: "rgba(255, 255, 255, 0.05)",
  /** --gray-700: the row arrow. */
  arrow: "#404040",
};

const LIGHT: typeof DARK = {
  hairline: "rgba(20, 18, 16, 0.12)",
  rule: "rgba(20, 18, 16, 0.08)",
  bone: "rgba(20, 18, 16, 0.06)",
  arrow: "#C4BAA6",
};

export type NewsTokens = typeof DARK;
export const newsTokens = (name: ThemeName): NewsTokens => (name === "dark" ? DARK : LIGHT);
