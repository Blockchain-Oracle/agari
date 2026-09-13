import { NextResponse } from "next/server";
import { readBoard } from "@/features/leaderboard/board.server";
import { STATS } from "@/features/stats/copy";

/**
 * Traction — the reference's `api/traction` walked its sponsor's transaction history; ours is the
 * venue-wide replay the board already runs, served from the same three-minute cache, so a page
 * that only wants numbers never pays for a second scan. No credential, no database.
 */
export const runtime = "nodejs";
// A cold scan measured 66 s on 2026-09-02; the reference's traction route allows 120 for the same reason.
export const maxDuration = 120;
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { traction, meta } = await readBoard();
    return NextResponse.json({ traction, meta: { period: meta.period, windowStartMs: meta.windowStartMs, windowEndMs: meta.windowEndMs, computedAtMs: meta.computedAtMs, complete: meta.complete, decimals: meta.decimals, symbol: meta.symbol } });
  } catch (error) {
    console.error("traction:", error);
    return NextResponse.json({ error: STATS.errors.compute }, { status: 503 });
  }
}
