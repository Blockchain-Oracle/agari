import { bytes32Schema, hexSchema } from "@masayume/core/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { confirmPlacement } from "@/features/games/lucky/lucky-settle.server";

/**
 * `POST /api/games/lucky/placed {drawId, status, txHash?}` — what the Ticket lane came back as. The server
 * believes the status about nothing that costs money: a `confirmed` is looked up on the tape by its
 * transaction and recorded at the measured quantity and cost, or held as `unknown` until the indexer has
 * it. A refusal, a revert, a fill that crossed nothing and a declined signature are all real rows.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

const requestSchema = z.object({
  drawId: bytes32Schema,
  status: z.enum(["confirmed", "nothingFilled", "refused", "reverted", "unknown", "declined"]),
  txHash: hexSchema.optional(),
});

export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "that is not a placement report" }, { status: 400 });
  const verdict = await confirmPlacement({ drawId: parsed.data.drawId, status: parsed.data.status, txHash: parsed.data.txHash ?? null });
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });
  return NextResponse.json(verdict.wire);
}
