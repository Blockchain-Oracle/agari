import { isArcadeGame } from "@masayume/core/games/arcade";
import { NextResponse } from "next/server";
import { readBoard } from "@/features/games/arcade/score.server";

/**
 * `GET /api/games/arcade/board?game=line-rider&address=0x…` — the board on the current engine build,
 * the asking wallet's own best and rank when it has one, and a fresh seed for the next run.
 * `configured: false` is the honest answer on a deployment with no store: play goes on, nothing posts.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const game = params.get("game") ?? "";
  if (!isArcadeGame(game)) return NextResponse.json({ error: "game required" }, { status: 400 });
  const address = params.get("address");
  const asked = address && /^0x[0-9a-fA-F]{40}$/.test(address) ? address.toLowerCase() : null;
  return NextResponse.json(await readBoard(game, asked));
}
