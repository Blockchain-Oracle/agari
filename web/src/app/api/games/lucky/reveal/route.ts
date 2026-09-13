import { bytes32Schema } from "@masayume/core/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { revealDraw } from "@/features/games/lucky/lucky.server";

/**
 * `POST /api/games/lucky/reveal {drawId, clientSeed}` — the browser's seed arrives, the draw is derived from
 * both seeds, the venue is scanned for a live Window on the drawn side, and every fact of the deal comes
 * back in the clear: seeds, nonce, policy, the candidate hash, the Window, the quote. Nothing is placed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** The scan quotes both sides of every eligible Window from the chain book; it is a few dozen reads. */
export const maxDuration = 60;

const requestSchema = z.object({ drawId: bytes32Schema, clientSeed: bytes32Schema });

export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "that is not a reveal" }, { status: 400 });
  const verdict = await revealDraw(parsed.data);
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });
  return NextResponse.json(verdict.wire);
}
