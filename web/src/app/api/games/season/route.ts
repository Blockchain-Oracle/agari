import { NextResponse } from "next/server";
import { seasonView } from "@/features/games/season.server";

/**
 * `GET /api/games/season` — the reference's `GET /season`: the season the operator configured, its prize
 * split, the derived headline pool, and — ours — what the pool contract actually escrows on chain.
 * `{ season: null }` when no season is configured, so a page can say the ladder is the record.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const view = await seasonView();
  return NextResponse.json(view ?? { season: null, escrow: null }, { headers: { "cache-control": "no-store" } });
}
