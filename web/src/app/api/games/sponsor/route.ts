import { addressSchema, bytes32Schema } from "@masayume/core/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { fundSeatKey, gameSponsorStatus } from "@/features/games/sponsor.server";

/**
 * `GET /api/games/sponsor` — whether a sponsor pays the duel's pick gas here, and whether it can right now.
 * `POST /api/games/sponsor` — send a seat's key its envelope, once the arena has named it.
 *
 * The entry reads GET before it is signed, so the payer is known before the prompt (doc 04 §Recovery:
 * "Sponsor unavailable: show payer/fallback before asking for a signature"). POST is what the lobby calls
 * the moment the entry confirms, and what the pick screen calls again if a key runs dry.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 90;

const requestSchema = z.object({ matchId: bytes32Schema, player: addressSchema, agent: addressSchema });

export async function GET() {
  return NextResponse.json(await gameSponsorStatus());
}

export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "that is not a top-up request" }, { status: 400 });
  const verdict = await fundSeatKey({ ...parsed.data, device: req.headers.get("x-masayume-device") ?? "", nowMs: Date.now() });
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });
  return NextResponse.json({ hash: verdict.hash, amountWei: verdict.amountWei.toString(), why: verdict.why });
}
