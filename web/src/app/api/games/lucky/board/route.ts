import { NextResponse } from "next/server";
import { luckyBoard } from "@/features/games/lucky/lucky-settle.server";

/**
 * `GET /api/games/lucky/board` — the streak ladder (Pips' per-game RANKS), over settled spins only. A spin
 * counts here only once its Window's verdict was read from the chain; nothing pending, refused or
 * unknown moves a row.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await luckyBoard());
}
