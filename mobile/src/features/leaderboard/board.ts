import { etDateOf } from "@agari/core/market";
import { formatBaseUnits } from "@agari/core/units";
import type { BoardSpan } from "@/features/leaderboard/copy";
import type { BoardQuery } from "@/features/leaderboard/leaderboard-client";
import type { BoardData, BoardRanking } from "@/features/leaderboard/protocol";

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

export interface BanzukeRow {
  rank: number;
  /** "4-5", or "49" when the west seat is empty. */
  label: string;
  /** 3 ranks 4–7, 4 ranks 8–12, 5 the long tail — web's tiers, which set the dividers and sizes. */
  tier: 3 | 4 | 5;
  east: BoardRanking | null;
  west: BoardRanking | null;
}

const PODIUM = 3;
const FIELD_END = 50;

function tierOf(rank: number): BanzukeRow["tier"] {
  if (rank <= 7) return 3;
  if (rank <= 12) return 4;
  return 5;
}

/** Ranks four to fifty, two to a row (east and west), as web's `banzukeRows`. */
export function banzukeRows(rankings: readonly BoardRanking[]): BanzukeRow[] {
  const field = rankings.slice(PODIUM, FIELD_END);
  const rows: BanzukeRow[] = [];
  for (let i = 0; i < field.length; i += 2) {
    const eastRank = i + PODIUM + 1;
    const west = field[i + 1] ?? null;
    rows.push({ rank: eastRank, label: west ? `${eastRank}-${eastRank + 1}` : String(eastRank), tier: tierOf(eastRank), east: field[i] ?? null, west });
  }
  return rows;
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
