import { TICKER_SYMBOLS } from "@agari/core/market";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { boardView, readBoard } from "@/features/leaderboard/board.server";
import { LEADERBOARD } from "@/features/leaderboard/copy";
import { BOARD_PERIODS } from "@/features/leaderboard/protocol";

/**
 * The board — ported from `reference/yosuku/app/api/leaderboard/route.ts` in shape: a server
 * route with a short cache, because ranking a venue is one scan per few minutes, not one per
 * visitor. No credential and no database: the indexer's fill tape is the only input.
 * `?period=24h|session` picks the cached scan; `?ticker=<SYM>` slices it (proof-analytics.md §2.3).
 */
export const runtime = "nodejs";
// A cold scan measured 66 s on 2026-09-02; the reference's traction route allows 120 for the same reason.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

const querySchema = z.object({ period: z.enum(BOARD_PERIODS).default("24h"), ticker: z.enum(TICKER_SYMBOLS).optional() });

export async function GET(request: NextRequest) {
  const query = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!query.success) return NextResponse.json({ error: query.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
  try {
    return NextResponse.json(boardView(await readBoard(query.data.period), query.data.ticker ?? null));
  } catch (error) {
    console.error("leaderboard:", error);
    return NextResponse.json({ error: LEADERBOARD.errors.compute }, { status: 503 });
  }
}
