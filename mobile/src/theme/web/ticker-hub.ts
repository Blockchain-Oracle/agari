import type { ThemeName } from "../index";

/**
 * web's /tickers/<SYMBOL> on a phone (ticker-hub.css, profile.css `.prf-*`, news.css, market-session.css `.mks-chip`,
 * desk-kit.css `.dkit-status`, source-line.css), as useagari.xyz computes it per theme. Everything else is a palette role.
 */
const DARK = {
  /** `--news-hairline`: the figure bar's rule. */
  barRule: "rgba(255, 255, 255, 0.12)",
  /** `.dkit-status[data-tone=live]`: the profit ink at 40 %. */
  liveBorder: "rgba(52, 211, 153, 0.4)",
  /** `.mks-chip` pre-market / after-hours dot: --gray-300. */
  chipDotLit: "#D4D4D4",
  /** `.mks-chip` holiday dot: vermilion at 55 %. */
  chipDotHoliday: "rgba(224, 77, 38, 0.55)",
  /** `.src-line-link` underline: --gray-700. */
  underline: "#404040",
};

const LIGHT: typeof DARK = {
  barRule: "rgba(20, 18, 16, 0.12)",
  liveBorder: "rgba(46, 107, 79, 0.4)",
  chipDotLit: "#453E33",
  chipDotHoliday: "rgba(217, 62, 31, 0.55)",
  underline: "#C4BAA6",
};

export type TickerHubTokens = typeof DARK;
export const tickerHubTokens = (name: ThemeName): TickerHubTokens => (name === "dark" ? DARK : LIGHT);
