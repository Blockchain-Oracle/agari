import type { BoardSpan } from "@/features/leaderboard/copy";

/** The phone board's own words (the owner's mobile-first pass); web's LEADERBOARD copy covers the rest. */
export const BOARD_PHONE = {
  eyebrow: "Everyone trading on Agari",
  stats: { traders: "Traders", staked: "Staked · top 50", close: "Next close" },
  periods: { session: "Session", "24h": "24h" },
  allTickers: "All",
  field: { title: "The field", desc: "Ranks four onward, by profit. Tap a name for their record." },
  record: (wins: number, losses: number, winRate: number) => `${wins}–${losses} · ${winRate}% wins`,
  sparse: (n: number, span: BoardSpan) => `${n} ${n === 1 ? "trader" : "traders"} ${span.period === "24h" ? "in the last 24 hours" : "this session"}`,
  sparseBody: "The field opens at fourth place. One settled call puts you on the board.",
  placeCall: "Place a call →",
  updated: (atMs: number) => `Updated ${new Date(atMs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
  retrying: "retrying",
  you: { unranked: "Unranked", of: (n: string) => `of ${n}`, net: "Net", ledger: "Your ledger →" },
} as const;
