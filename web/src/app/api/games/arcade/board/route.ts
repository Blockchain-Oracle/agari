import { isArcadeGame } from "@agari/core/games/arcade";
import { isAddress } from "@agari/core/types";
import { NextResponse } from "next/server";
import { readBoard } from "@/features/games/arcade/score.server";

/**
 * `GET /api/games/arcade/board?game=line-rider&address=<base58>` — the board on the current engine build,
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
  const asked = address && isAddress(address) ? address : null;
  return NextResponse.json(await readBoard(game, asked));
}
