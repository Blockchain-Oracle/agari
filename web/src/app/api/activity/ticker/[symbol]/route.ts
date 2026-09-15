import { isTickerSymbol } from "@agari/core/market";
import { NextResponse } from "next/server";
import { tickerFeed } from "@/features/activity/feed.server";

/** `GET /api/activity/ticker/:symbol`: a ticker hub's calls, verdicts and tagged takes (spec §1.6). Public, briefly shared. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_CACHE = { "cache-control": "public, s-maxage=5, stale-while-revalidate=15" };
const NO_STORE = { "cache-control": "no-store" };

export async function GET(_req: Request, context: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await context.params;
  const upper = symbol.toUpperCase();
  if (!isTickerSymbol(upper)) return NextResponse.json({ error: `no listed ticker ${symbol}` }, { status: 404, headers: NO_STORE });
  try {
    return NextResponse.json(await tickerFeed(upper), { headers: PUBLIC_CACHE });
  } catch {
    return NextResponse.json({ error: "activity query failed" }, { status: 503, headers: NO_STORE });
  }
}
