import { addressSchema } from "@agari/core/types";
import { NextResponse } from "next/server";
import { achievementsFor } from "@/features/games/achievements.server";

/**
 * One wallet's badges. The address is a plain query parameter and nothing is signed for: every fact behind a badge is
 * already public (the arena's events, the ladder, the arcade board), so this reveals nothing a reader could not
 * assemble themselves, and asking for a signature would only make the shelf harder to show.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("wallet");
  const parsed = raw ? addressSchema.safeParse(raw) : null;
  if (raw && !parsed?.success) return NextResponse.json({ error: "that is not an address" }, { status: 400 });
  return NextResponse.json(await achievementsFor(parsed?.success ? parsed.data : null));
}
