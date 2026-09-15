import { addDays, etDateOf, TICKER_SYMBOLS, tickerSymbolSchema } from "@agari/core/market";
import { NextResponse, type NextRequest } from "next/server";
import type { EarningsPayload } from "@/features/news/protocol";
import { earningsWithin, finnhubConfigured } from "@/lib/finnhub.server";

/**
 * `GET /api/earnings?symbol=TSLA` — the next reports from Finnhub's calendar (social-assistant.md §1.4, §3), for one
 * registry ticker or, without `symbol`, all of them. The answer covers today (ET) through `throughDateEt`, so an empty
 * list is a real "no report before then", and a calendar that can't be read is a 503, never an empty list.
 */
export const runtime = "nodejs";

/** The Finnhub client's per-ticker lookahead: the longest horizon it answers from one cached call. */
const HORIZON_DAYS = 60;
const REVALIDATE_SEC = 21_600;
const CACHED = `public, s-maxage=${REVALIDATE_SEC}, stale-while-revalidate=3600`;
const UNCACHED = { "cache-control": "no-store" };

export async function GET(request: NextRequest) {
  const rawSymbol = request.nextUrl.searchParams.get("symbol");
  const parsed = rawSymbol === null ? null : tickerSymbolSchema.safeParse(rawSymbol.toUpperCase());
  if (parsed && !parsed.success) return NextResponse.json({ error: "unknown symbol" }, { status: 400, headers: UNCACHED });
  if (!finnhubConfigured()) return NextResponse.json({ error: "earnings provider not configured" }, { status: 503, headers: UNCACHED });

  const events = await earningsWithin(parsed ? [parsed.data] : TICKER_SYMBOLS, HORIZON_DAYS);
  if (events === null) return NextResponse.json({ error: "earnings calendar unavailable" }, { status: 503, headers: UNCACHED });
  const body: EarningsPayload = { events, throughDateEt: addDays(etDateOf(Math.floor(Date.now() / 1000)), HORIZON_DAYS) };
  return NextResponse.json(body, { headers: { "cache-control": CACHED } });
}
