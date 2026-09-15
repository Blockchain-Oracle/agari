import { getDb } from "@agari/db";
import { NextResponse } from "next/server";
import { readCrowd } from "./crowd";

/**
 * `GET /api/sentiment` — the marquee's sentiment cell (social-assistant.md §1.5, Q-S13-1). Crowd flow from the index,
 * labelled as the crowd: the Up share of taker lots over the last hour, in integer bps, `null` below 20 fills. Not a
 * Fear & Greed reading, and never dressed as one. Read-only over `idx_fills`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHED = "public, s-maxage=30";
const UNCACHED = { "cache-control": "no-store" };

export async function GET() {
  const sql = getDb();
  if (!sql) return NextResponse.json({ error: "indexer not configured" }, { status: 503, headers: UNCACHED });
  try {
    const reading = await readCrowd(sql, Math.floor(Date.now() / 1000));
    return NextResponse.json(reading, { headers: { "cache-control": CACHED } });
  } catch {
    return NextResponse.json({ error: "indexer query failed" }, { status: 503, headers: UNCACHED });
  }
}
