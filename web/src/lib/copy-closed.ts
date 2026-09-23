/**
 * The closed-market words (S23): what a board, a ticket and a picker say while the stock market is shut and only
 * the 24/7 lanes trade. Plain facts only; no surface explains why.
 */
export const CLOSED = {
  /** The strip above a board while the stock market is shut: "US stocks · Pre-market · opens 14:30 (09:30 ET), in 4h 04m". */
  strip: (phrase: string) => `US stocks · ${phrase}`,
  stripTail: "Pre-IPO names and baskets trade around the clock.",
  /** The listed group's heading: "Schedule a call · opens Wed 09:30 ET". */
  listed: (opens: string) => `Schedule a call · opens ${opens}`,
  /** A 24/7 card's kind chip. */
  kind: { preIpo: "24/7 · pre-IPO", basket: "24/7 · basket", valuation: "24/7 · valuation", stock: "24/7 · xStock", etf: "24/7 · xStock" },
  noQuotes: "No quotes yet",
  noQuotesLine: "Nobody is quoting this Window right now.",
  nextWindow: (clock: string) => `Next Window ${clock}`,
  callUp: "Call Up",
  callDown: "Call Down",
  cadencesAria: "Window length",
  /** The ticket's Max when the stake is more than the book holds: "Use 12.40 tUSDC, all the book can fill". */
  useDepth: (text: string) => `Use ${text}, all the book can fill`,
  windows: (n: number) => (n === 1 ? "1 Window" : `${n} Windows`),
} as const;
