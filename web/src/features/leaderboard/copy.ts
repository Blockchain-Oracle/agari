import type { BoardPeriod } from "./protocol";

/** What a board covers, in words: the rolling day, today's session (so far or whole), or an earlier session by date. */
export interface BoardSpan {
  period: BoardPeriod;
  /** The session's ET date (`YYYY-MM-DD`), null on the 24 h board. */
  sessionDate: string | null;
  /** The session is today's (ET). */
  today: boolean;
  /** The scan ended before the session's last Windows settled. */
  live: boolean;
}

const dateLabel = (date: string) => {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
};

/** An earlier session, by its date; null for the 24 h board, today's session, or a session not answered yet. */
const pastDate = (span: BoardSpan): string | null => (span.period === "session" && span.sessionDate !== null && !span.today ? dateLabel(span.sessionDate) : null);

/** "the last 24 hours", "this session", "the Mon, Sep 14 session". */
function spanWords(span: BoardSpan): string {
  if (span.period === "24h") return "the last 24 hours";
  const date = pastDate(span);
  return date ? `the ${date} session` : "this session";
}

function coverage(span: BoardSpan, complete: boolean): string {
  if (span.period === "24h") return complete ? "full day" : "partial day";
  if (!complete) return "partial session";
  return span.live ? "session so far" : "full session";
}

/** `/leaderboard` — ported from the reference's leaderboard page; facts adapted to Agari's sessions and tickers. */
export const LEADERBOARD = {
  title: "Leaderboard",
  hero: {
    eyebrow: "Everyone trading on Agari",
    title: ["The", "house", "of names."] as const,
    traders: (period: BoardPeriod) => (period === "24h" ? "Traders on Agari · 24h" : "Traders on Agari · session"),
    staked: "Total staked · top 50",
    nextClose: "Next market closes in",
    stamp: (period: BoardPeriod) => (period === "24h" ? "TODAY'S BOARD" : "SESSION BOARD"),
    stampSub: (span: BoardSpan) => (span.period === "24h" ? "ROLLING" : span.sessionDate === null ? "—" : dateLabel(span.sessionDate).toUpperCase()),
    periods: { session: "This session", "24h": "Last 24 hours" } as Record<BoardPeriod, string>,
    periodGroup: "Board period",
    closedCalls: (n: number, span: BoardSpan, complete: boolean, ticker: string | null) =>
      `${n.toLocaleString()} closed calls${ticker ? ` · ${ticker}` : ""} · ${coverage(span, complete)}`,
    counting: "counting recent closes",
  },
  loading: "Reading on-chain trade data…",
  refreshing: "Showing the last computed board while rankings refresh.",
  refreshFailed: "The update could not be read. These are the last computed rankings; we'll retry automatically.",
  updated: (atMs: number) => `Computed ${new Date(atMs).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}`,
  empty: {
    headline: "No closed calls in this window yet.",
    body: "The board ranks players by real profit, so names show up once bets settle. Check back after the next few rounds settle.",
  },
  failed: "The board is taking longer than expected. We'll check again automatically.",
  retry: "Try again",
  podium: {
    number: "01",
    title: "The podium",
    desc: (span: BoardSpan) => `The top three on Agari by profit over ${spanWords(span)}, whoever they traded through.`,
    ordinals: { 1: "1ST", 2: "2ND", 3: "3RD" } as Record<1 | 2 | 3, string>,
    sash: "GRAND CHAMPION",
    streak: (n: number) => `${n} WIN STREAK`,
    challenger: "CHALLENGER",
    contender: "CONTENDER",
  },
  field: {
    number: "02",
    title: "The field",
    desc: "Ranks four onward, ordered by profit.",
    meta: (span: BoardSpan) => (span.period === "24h" ? "rolling 24h" : pastDate(span) ? `session of ${pastDate(span)}` : "this session"),
    strip: {
      ranks: "RANKS 04-50",
      center: (span: BoardSpan) => (span.period === "24h" ? "LAST 24 HOURS · PROFIT" : `${pastDate(span)?.toUpperCase() ?? "THIS"} SESSION · PROFIT`),
      right: "CLOSED CALLS",
    },
    heads: { east: "Ranked account", center: "RANKS", west: "Ranked account" },
    dividers: { rankAndFile: "RANK & FILE", longTail: "THE LONG TAIL" },
    cellMeta: (rank: number, calls: number, winRate: number) => `#${rank} · ${calls} calls · ${winRate}% wins`,
  },
  /** Masayume's "Live activity" (`/stats`), under the board. */
  activity: {
    number: "03",
    title: "Live activity",
    desc: "The latest calls and cash-outs on Agari. Click any row → Solana Explorer.",
    updated: (ago: string) => `updated ${ago}`,
    reading: "reading the chain…",
    unreachable: "couldn't reach the chain, retrying…",
  },
  you: {
    rank: "Your rank",
    unranked: "Unranked",
    of: (n: string) => `of ${n} on the venue`,
    name: (short: string) => `You · ${short}`,
    top: (pct: number) => `top ${pct}%`,
    none: (span: BoardSpan) => `no closed calls in ${spanWords(span)}`,
    net: "Net",
    winRate: "Win rate",
    streak: "Streak",
    cta: "Your ledger →",
  },
  dash: "—",
  errors: { compute: "The board could not be computed." },
} as const;
