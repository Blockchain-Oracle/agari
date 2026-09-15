import { addressSchema } from "@agari/core/types";
import { NextResponse } from "next/server";
import { followingFeed } from "@/features/activity/feed.server";

/** `GET /api/activity/following?wallet`: the calls, verdicts and takes of the wallets this one follows (spec §1.6). */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };

export async function GET(req: Request) {
  const wallet = addressSchema.safeParse(new URL(req.url).searchParams.get("wallet"));
  if (!wallet.success) return NextResponse.json({ error: "wallet must be a base58 address" }, { status: 400, headers: NO_STORE });
  try {
    return NextResponse.json(await followingFeed(wallet.data), { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "activity query failed" }, { status: 503, headers: NO_STORE });
  }
}
