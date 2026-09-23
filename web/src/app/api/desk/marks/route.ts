import { PRE_IPO_SYMBOLS } from "@agari/core/market";
import { NextResponse } from "next/server";
import { deskStore } from "@/features/desk/desk.server";

/**
 * `GET /api/desk/marks`: the last seven days of hourly PreStocks token prices for every name the desk can hold (S22),
 * the one read behind the studio's basket sparklines and the holdings' lines before a desk has history. Public data,
 * cached at the edge for five minutes; 503 without the desk index.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WEEK_SEC = 7 * 86_400;

export async function GET() {
  const store = deskStore();
  if (!store) return NextResponse.json({ ok: false, error: "desk index not configured" }, { status: 503, headers: { "cache-control": "no-store" } });
  const toSec = Math.floor(Date.now() / 1000);
  const rows = await Promise.all(PRE_IPO_SYMBOLS.map((symbol) => store.listPriceMarks({ symbol, fromSec: toSec - WEEK_SEC, toSec })));
  const marks = Object.fromEntries(
    PRE_IPO_SYMBOLS.map((symbol, i) => [symbol, (rows[i] as Array<{ atSec: number; tokenE8: string }>).map((r) => ({ atSec: Number(r.atSec), tokenE8: String(r.tokenE8) }))]),
  );
  return NextResponse.json({ marks, toSec }, { headers: { "cache-control": "public, s-maxage=300, stale-while-revalidate=600" } });
}
