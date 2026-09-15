import { TICKER_SYMBOLS } from "@agari/core/market";
import type { Address } from "@agari/core/types";
import { z } from "zod";
import { tractionSchema } from "@/features/stats/protocol";

/** "This session" first: a stock venue's day is its session; "24h" is Masayume's rolling board. */
export const BOARD_PERIODS = ["session", "24h"] as const;
export type BoardPeriod = (typeof BOARD_PERIODS)[number];

/** The NYSE session a `session` board covers: `[openSec, closeSec + 15 min)`, capped at the time it was computed. */
const sessionSchema = z.object({ date: z.string(), openSec: z.number(), closeSec: z.number() });

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
    period: z.enum(BOARD_PERIODS),
    /** Null for the whole venue; a symbol when the route sliced one ticker's board from the cached scan. */
    ticker: z.enum(TICKER_SYMBOLS).nullable(),
    session: sessionSchema.nullable(),
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

/** One ticker's board inside the cached scan (`VenueBoard.byTicker`), sliced out by the route. */
export interface BoardSliceWire {
  rankings: LeaderboardPayload["rankings"];
  rankedTraders: number;
  totalWallets: number;
  closedCalls: number;
  totalVolumeBase: string;
}

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

type WireMeta = LeaderboardPayload["meta"];

export interface BoardData {
  rankings: BoardRanking[];
  /** `ticker` and `session` are optional here so canned boards from before S5 still render as the venue's 24 h board. */
  meta: Omit<WireMeta, "totalVolumeBase" | "ticker" | "session"> & { totalVolumeBase: bigint; ticker?: WireMeta["ticker"]; session?: WireMeta["session"] };
}

export function toBoardData(payload: LeaderboardPayload): BoardData {
  return {
    rankings: payload.rankings.map((r) => ({ ...r, owner: r.owner as Address, pnlBase: BigInt(r.pnlBase), volumeBase: BigInt(r.volumeBase) })),
    meta: { ...payload.meta, totalVolumeBase: BigInt(payload.meta.totalVolumeBase) },
  };
}
