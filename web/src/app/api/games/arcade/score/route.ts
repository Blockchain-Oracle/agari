import { NextResponse } from "next/server";
import { acceptScore, scoreClaimSchema } from "@/features/games/arcade/score.server";

/**
 * `POST /api/games/arcade/score` — a finished run, as the claim the browser makes about it: the game,
 * the room token that names the wallet, the seed, the engine build, the length, the score, the calm
 * flag and the trace. The server replays it and records only what it reproduced; the response is where
 * the run landed and the board as it now stands (Pips's `MinigameSubmit`).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const parsed = scoreClaimSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "that is not an arcade score" }, { status: 400 });
  const verdict = await acceptScore(parsed.data, req.headers.get("x-masayume-device") ?? "", Date.now());
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });
  return NextResponse.json(verdict.body);
}
