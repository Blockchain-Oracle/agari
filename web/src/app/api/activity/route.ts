import { addressSchema } from "@agari/core/types";
import { NextResponse } from "next/server";
import { z } from "zod";
import { inboxFeed } from "@/features/activity/feed.server";

/**
 * `GET /api/activity?wallet&sinceSec`: one wallet's inbox from the index (spec §1.6). Index data is public, so there
 * is no session; the answer is still per wallet and polled every 15 s, so it is never cached. `LifecycleWatcher`
 * reads it with `sinceSec` to learn what changed since its last poll.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "cache-control": "private, no-store" };
const querySchema = z.object({ wallet: addressSchema, sinceSec: z.coerce.number().int().nonnegative().optional() });

export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const parsed = querySchema.safeParse({ wallet: params.get("wallet"), sinceSec: params.get("sinceSec") ?? undefined });
  if (!parsed.success) return NextResponse.json({ error: "wallet must be a base58 address; sinceSec a unix second" }, { status: 400, headers: NO_STORE });
  try {
    return NextResponse.json(await inboxFeed(parsed.data.wallet, parsed.data.sinceSec), { headers: NO_STORE });
  } catch {
    return NextResponse.json({ error: "activity query failed" }, { status: 503, headers: NO_STORE });
  }
}
