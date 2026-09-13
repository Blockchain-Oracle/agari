import { addressSchema } from "@masayume/core/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { commitDraw } from "@/features/games/lucky/lucky.server";

/**
 * `POST /api/games/lucky/commit {wallet, stakeBase}` — the server draws its seed, hashes it, and hands the
 * hash back before anything else happens. The reels start on this; the browser chooses its own seed only
 * after it has seen it, which is what makes the draw provable rather than merely random.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({ wallet: addressSchema, stakeBase: z.string().regex(/^\d+$/) });

export async function POST(req: Request) {
  const parsed = requestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "that is not a spin" }, { status: 400 });
  const verdict = await commitDraw({ wallet: parsed.data.wallet, stakeBase: BigInt(parsed.data.stakeBase), device: req.headers.get("x-masayume-device") ?? "", nowMs: Date.now() });
  if (!verdict.ok) return NextResponse.json({ error: verdict.error }, { status: verdict.status });
  return NextResponse.json(verdict.wire);
}
