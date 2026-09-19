import type { TickerSymbol } from "@agari/core/market";

/**
 * `/tickers/[SYMBOL]` — one stock's square: its price and session, its next report, its Room, what traders called on
 * its Windows, and its headlines. Masayume has no ticker page; the frame is `/news`'s and every list is its wire.
 */
export const TICKER_HUB = {
  title: (symbol: TickerSymbol, name: string) => `${name} (${symbol})`,
  eyebrow: (kind: "stock" | "etf" | "preIpo") => (kind === "etf" ? "ETF" : kind === "preIpo" ? "Pre-IPO" : "Stock"),
  headingJp: "銘柄の広場。",
  intro: (name: string) => `Everything Agari knows about ${name} in one place: the live print, the session, the next report, and every call on its Windows.`,
  spot: "Spot",
  spotStale: "last print",
  earnings: "Next report",
  earningsNone: "none scheduled",
  earningsUnknown: "—",
  hour: { bmo: "before open", amc: "after close", dmh: "during hours" } as const,
  cadences: "Windows",
  dash: "—",
  trade: "Trade it →",

  /** A pre-IPO name (D-100): no report date exists, so the bar shows what only PreStocks has. */
  preIpo: {
    intro: (name: string) => `Everything Agari knows about ${name} in one place: the PreStocks token price, the SPV's own valuation, how far apart the two sit, and every call on its Windows.`,
    mark: "Mark price",
    markHint: "PreStocks' valuation of the company per token",
    premium: "Token vs mark",
    premiumLine: (bps: number) => `${bps >= 0 ? "+" : "−"}${(Math.abs(bps) / 100).toFixed(1)}% ${bps >= 0 ? "above" : "below"}`,
    holders: "Holders",
    holdersLine: (now: number, monthAgo: number | null) => (monthAgo === null ? now.toLocaleString("en-US") : `${now.toLocaleString("en-US")} (${now >= monthAgo ? "+" : "−"}${Math.abs(now - monthAgo).toLocaleString("en-US")} in 4 wk)`),
    source: "Single source · signed by Agari from the PreStocks feed · no cross-check",
  },

  feed: { number: "01", title: "Calls", desc: "Fills on this ticker's Windows, the verdicts of the traders who made them, and takes tagged with its cashtag." },
  news: { number: "02", title: "Headlines", desc: "Stories about this company, newest first.", credit: "Headlines via Finnhub" },
  board: {
    number: "03",
    title: "Board",
    desc: "The traders with the best record on this ticker.",
    pending: "The per-ticker board arrives with the leaderboard's ticker tabs. Until then, the full board ranks everyone.",
    link: "Open the leaderboard →",
  },
} as const;
