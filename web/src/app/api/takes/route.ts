import { insertTake, isDbConfigured, listTakes, type TakeRecord } from "@masayume/db";
import { ensureMarkets, marketsProvider, parseMarketsEnv } from "@masayume/markets";
import { secToMs } from "@masayume/core/units";
import { NextResponse } from "next/server";
import { holdsPosition } from "@/features/room/gate.server";
import { TAKE_ERRORS } from "@/features/takes/copy";
import { TAKE_SIGNATURE_TTL_MS, TAKES_FEED_LIMIT, takePostRequestSchema, type FeedTake, type TakesFeed } from "@/features/takes/protocol";
import { verifyTakeSignature } from "@/features/takes/verify.server";

/**
 * The take board — the reference's `take_board::post_take` and its `TakePosted`
 * event stream, as a route over the social store.
 *
 * Reading is public, as the reference's feed is. Posting proves two things here
 * rather than in the browser: the wallet owns the address (a signature the route
 * verifies) and — for the "✓ position" badge — whether it holds a position on the
 * Window (a chain read the route makes). The reference's badge comes from an order
 * id the bet flow hands over; ours comes from the same read the Room's gate makes,
 * so the badge can never be asserted by a client.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const toFeedTake = (row: TakeRecord): FeedTake => ({
  id: row.id,
  marketId: row.marketId as FeedTake["marketId"],
  author: row.author as FeedTake["author"],
  side: row.side,
  caption: row.caption,
  asset: row.asset,
  intervalSec: row.intervalSec,
  expirySec: row.expirySec,
  lineRaw: row.lineRaw,
  backed: row.backed,
  createdAtMs: row.createdAtMs,
});

function refuse(error: string, status: number) {
  return NextResponse.json({ error }, { status });
}

export async function GET(req: Request) {
  // An unconfigured store is an expected state, not a failure: the reel carries
  // markets alone and the composer says what is missing.
  if (!isDbConfigured()) return NextResponse.json({ configured: false, takes: [] } satisfies TakesFeed);

  const limitParam = Number(new URL(req.url).searchParams.get("limit"));
  const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 100) : TAKES_FEED_LIMIT;
  const rows = await listTakes(limit);
  if (rows === null) return refuse(TAKE_ERRORS.unavailable, 503);
  return NextResponse.json({ configured: true, takes: rows.map(toFeedTake) } satisfies TakesFeed);
}

export async function POST(req: Request) {
  if (!isDbConfigured()) return refuse(TAKE_ERRORS.unavailable, 503);

  const parsed = takePostRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return refuse(TAKE_ERRORS.badRequest, 400);
  const { marketId, side, caption, address, issuedAtMs, signature } = parsed.data;

  const now = Date.now();
  if (Math.abs(now - issuedAtMs) > TAKE_SIGNATURE_TTL_MS) return refuse(TAKE_ERRORS.staleSignature, 400);
  if (!(await verifyTakeSignature({ marketId, side, caption, address, issuedAtMs, signature }))) return refuse(TAKE_ERRORS.badSignature, 401);

  // The Window's facts come from the venue, never from the request body — a client
  // that could name its own line could post a call about a number that never printed.
  ensureMarkets(parseMarketsEnv());
  const reading = await marketsProvider.getMarket(marketId as Parameters<typeof marketsProvider.getMarket>[0]);
  if (!reading.ok) return refuse(TAKE_ERRORS.gateUnreadable, 503);
  const market = reading.value;
  if (!market) return refuse(TAKE_ERRORS.noWindow, 404);
  if (secToMs(market.expirySec) <= now) return refuse(TAKE_ERRORS.windowClosed, 409);

  let backed: boolean;
  try {
    backed = await holdsPosition(address, marketId);
  } catch {
    // Not "you hold nothing" — an unreadable chain would then stamp a bettor's call
    // "open call", which is the wrong badge for the wrong reason.
    return refuse(TAKE_ERRORS.gateUnreadable, 503);
  }

  const row = await insertTake({
    marketId,
    author: address,
    side,
    caption,
    asset: market.asset,
    intervalSec: market.intervalSec,
    expirySec: market.expirySec,
    lineRaw: market.openingPriceRaw === null ? null : market.openingPriceRaw.toString(),
    backed,
    signature,
    issuedAtMs,
  });
  if (row === null) return refuse(TAKE_ERRORS.unavailable, 503);
  return NextResponse.json({ take: toFeedTake(row) });
}
