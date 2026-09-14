import { getDb, indexReader, type IndexReader } from "@agari/db";
import { ensureMarkets, eventsProgramAddress } from "@agari/markets";
import { NextResponse, type NextRequest } from "next/server";
import { webEnv } from "@/lib/env";
import { BadRequest, resolveIndexQuery } from "./queries";

/**
 * The indexer's read API (first-call.md §5): lists, Window rows with prints, wallet fills, positions and actions,
 * print history, candles and freshness, straight from the soak's Postgres. Never gates a write: every read that
 * can, comes from chain. Public answers ride a 2 s shared cache; wallet answers are never cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PUBLIC_CACHE = "public, s-maxage=2, stale-while-revalidate=8";
const PRIVATE_CACHE = "private, no-store";

let reader: IndexReader | null = null;

export async function GET(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: "indexer not configured" }, { status: 503, headers: { "cache-control": PRIVATE_CACHE } });
  reader ??= indexReader(db);
  ensureMarkets(webEnv.markets);

  const { path } = await context.params;
  const query = Object.fromEntries(request.nextUrl.searchParams);
  let resolved;
  try {
    resolved = resolveIndexQuery(path, query, eventsProgramAddress());
  } catch (error) {
    if (error instanceof BadRequest) return NextResponse.json({ error: error.message }, { status: 400 });
    throw error;
  }
  if (!resolved) return NextResponse.json({ error: `no index path /${path.join("/")}` }, { status: 404 });

  try {
    const rows = await resolved.run(reader);
    return NextResponse.json({ rows }, { headers: { "cache-control": resolved.scope === "wallet" ? PRIVATE_CACHE : PUBLIC_CACHE } });
  } catch {
    // The connection or the query failed: an outage, which the provider reads as `indexer-down` and retries.
    return NextResponse.json({ error: "indexer query failed" }, { status: 503, headers: { "cache-control": PRIVATE_CACHE } });
  }
}
