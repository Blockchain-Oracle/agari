import type { Address } from "@masayume/core/types";
import { z } from "zod";
import { tractionSchema } from "@/features/stats/protocol";

/** Wire shape of `/api/leaderboard` — base units travel as decimal strings, never floats. */
const rankingSchema = z.object({
  owner: z.string(),
  pnlBase: z.string(),
  roiBps: z.number().nullable(),
  winRatePct: z.number(),
  tradeCount: z.number(),
  settledTrades: z.number(),
  bestStreak: z.number(),
  volumeBase: z.string(),
});

export const leaderboardPayloadSchema = z.object({
  rankings: z.array(rankingSchema),
  /** The same scan's traction, served to `/api/traction` from the same cache. */
  traction: tractionSchema,
  meta: z.object({
    period: z.literal("24h"),
    windowStartMs: z.number(),
    windowEndMs: z.number(),
    computedAtMs: z.number(),
    rankedTraders: z.number(),
    totalWallets: z.number(),
    closedCalls: z.number(),
    totalVolumeBase: z.string(),
    /** False when a paging cap or a dropped page means the window is not fully covered. */
    complete: z.boolean(),
    decimals: z.number(),
    symbol: z.string(),
  }),
});

export type LeaderboardPayload = z.infer<typeof leaderboardPayloadSchema>;

export interface BoardRanking {
  owner: Address;
  pnlBase: bigint;
  roiBps: number | null;
  winRatePct: number;
  tradeCount: number;
  settledTrades: number;
  bestStreak: number;
  volumeBase: bigint;
}

export interface BoardData {
  rankings: BoardRanking[];
  meta: Omit<LeaderboardPayload["meta"], "totalVolumeBase"> & { totalVolumeBase: bigint };
}

export function toBoardData(payload: LeaderboardPayload): BoardData {
  return {
    rankings: payload.rankings.map((r) => ({ ...r, owner: r.owner as Address, pnlBase: BigInt(r.pnlBase), volumeBase: BigInt(r.volumeBase) })),
    meta: { ...payload.meta, totalVolumeBase: BigInt(payload.meta.totalVolumeBase) },
  };
}
