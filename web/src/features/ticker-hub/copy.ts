import type { TickerSymbol } from "@agari/core/market";

/**
 * `/tickers/[SYMBOL]` — one stock's square: its price and session, its next report, its Room, what traders called on
 * its Windows, and its headlines. Masayume has no ticker page; the frame is `/news`'s and every list is its wire.
 */
export const TICKER_HUB = {
  title: (symbol: TickerSymbol, name: string) => `${name} (${symbol})`,
  eyebrow: (kind: "stock" | "etf") => (kind === "etf" ? "ETF" : "Stock"),
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
