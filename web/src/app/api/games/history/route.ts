import { gamesStoreConfigured, listMatchesFor } from "@masayume/db";
import { NextResponse } from "next/server";

/**
 * `GET /api/games/history?address=0x…` — a wallet's duels, newest first, from the projector's own table
 * (Flicky's `GET /duels/recent?player=…`). `configured: false` is the honest answer on a deployment
 * with no store: a page must say "not connected here", never "you have played nothing".
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const LIMIT = 50;

export async function GET(request: Request) {
  const address = new URL(request.url).searchParams.get("address");
  if (!address || !/^0x[0-9a-fA-F]{40}$/.test(address)) return NextResponse.json({ error: "address required" }, { status: 400 });
  if (!gamesStoreConfigured()) return NextResponse.json({ configured: false, rows: [] });
  const rows = await listMatchesFor(address, LIMIT);
  return NextResponse.json({ configured: true, rows });
}
