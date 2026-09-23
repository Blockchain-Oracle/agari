import { etDateOf } from "@agari/core/market";
import { formatBaseUnits } from "@agari/core/units";
import { router, type Href } from "expo-router";
import type { BoardSpan } from "@/features/leaderboard/copy";
import type { BoardQuery } from "@/features/leaderboard/leaderboard-client";
import type { BoardData, BoardRanking } from "@/features/leaderboard/protocol";
import { profileHref } from "@/features/takes/cashtags";

/**
 * The board's pure shaping, as web does it in its view files (Podium.tsx `podiumOrder`, Banzuke.tsx `banzukeRows`,
 * LeaderboardBoard.tsx `spanOf`) — kept here so the app imports no web view module.
 */

export type Spot = BoardRanking & { r: 1 | 2 | 3 };

/** [2nd, 1st, 3rd] — the podium's own order. */
export function podiumOrder(rankings: readonly BoardRanking[]): Spot[] {
  if (rankings.length < 3) return rankings.map((t, i) => ({ ...t, r: (i + 1) as 1 | 2 | 3 }));
  return [
    { ...(rankings[1] as BoardRanking), r: 2 },
    { ...(rankings[0] as BoardRanking), r: 1 },
    { ...(rankings[2] as BoardRanking), r: 3 },
  ];
}

export interface FieldRow {
  rank: number;
  /** 3 ranks 4–7, 4 ranks 8–12, 5 the long tail — web's tiers, which set the dividers. */
  tier: 3 | 4 | 5;
  trader: BoardRanking;
}

const PODIUM = 3;
const FIELD_END = 50;

function tierOf(rank: number): FieldRow["tier"] {
  if (rank <= 7) return 3;
  if (rank <= 12) return 4;
  return 5;
}

/** Ranks four to fifty. Web pairs them east and west on a wide screen; a phone reads them one to a row. */
export function fieldRows(rankings: readonly BoardRanking[]): FieldRow[] {
  return rankings.slice(PODIUM, FIELD_END).map((trader, i) => ({ rank: i + PODIUM + 1, tier: tierOf(i + PODIUM + 1), trader }));
}

const SETTLE_TAIL_MS = 900_000;

/** The span the shown board covers; before the first answer, the selected period with no session yet. */
export function spanOf(data: BoardData | null, board: BoardQuery, nowMs: number): BoardSpan {
  const session = data?.meta.session ?? null;
  if (!data || data.meta.period !== board.period || session === null) return { period: board.period, sessionDate: null, today: false, live: false };
  return {
    period: data.meta.period,
    sessionDate: session.date,
    today: nowMs > 0 && etDateOf(Math.floor(nowMs / 1000)) === session.date,
    live: data.meta.windowEndMs < session.closeSec * 1000 + SETTLE_TAIL_MS,
  };
}

/** `+12.40` — a board figure carries its sign. */
export const signedPnl = (value: bigint, decimals: number): string => `${value >= 0n ? "+" : ""}${formatBaseUnits(value, decimals)}`;

/** A trader's profile (`/u/[address]`, web's `profileHref`); the cast covers the route until its screen lands. */
export function openProfile(address: string): void {
  router.push(profileHref(address) as Href);
}
