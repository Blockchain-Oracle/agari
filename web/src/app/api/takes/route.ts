import { isTickerSymbol } from "@agari/core/market";
import { isAddress } from "@agari/core/types";
import { insertTake, isDbConfigured, listTakes, type TakeRecord, type TakesQuery } from "@agari/db";
import { ensureMarkets, marketsProvider, parseMarketsEnv } from "@agari/markets";
import { secToMs } from "@agari/core/units";
import { NextResponse } from "next/server";
import { GateUnreadableError, holdsPosition } from "@/features/room/gate.server";
import { ROOM_LIMITS } from "@/features/room/limits.server";
import { parseCashtags } from "@/features/takes/cashtags";
import { TAKE_ERRORS } from "@/features/takes/copy";
import { TAKE_SIGNATURE_TTL_MS, TAKES_AUTHORS_MAX, TAKES_FEED_LIMIT, TAKES_PAGE_MAX, takePostRequestSchema, type FeedTake, type TakesFeed } from "@/features/takes/protocol";
import { verifyTakeSignature } from "@/features/takes/verify.server";

/**
 * The take board — the reference's `take_board::post_take` and its `TakePosted`
 * event stream, as a route over the social store.
 *
 * Reading is public, as the reference's feed is, and can be narrowed to one ticker's
 * cashtag (`?symbol=TSLA`) or a set of authors (`?authors=a,b`). Posting proves two
 * things here rather than in the browser: the wallet owns the address (a signature the
 * route verifies) and — for the "✓ position" badge — whether it has bet on the Window
 * (the Room's own gate). The reference's badge comes from an order id the bet flow
 * hands over; ours comes from the gate, so the badge can never be asserted by a client.
 */
export const runtime = "nodejs";
export const maxDuration = 30;

const FEED_CACHE = "public, s-maxage=5, stale-while-revalidate=15";

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
  tags: row.tags.filter(isTickerSymbol),
});

function refuse(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

/** `?limit&symbol&authors`, or null when a filter names something that can't exist. */
function feedQuery(params: URLSearchParams): TakesQuery | null {
  const limitParam = Number(params.get("limit"));
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, TAKES_PAGE_MAX) : TAKES_FEED_LIMIT;
  const query: TakesQuery = { limit };
  const symbol = params.get("symbol");
  if (symbol !== null) {
    const upper = symbol.trim().toUpperCase();
    if (!isTickerSymbol(upper)) return null;
    query.symbol = upper;
  }
  const authors = params.get("authors");
  if (authors !== null) {
    const list = [...new Set(authors.split(",").map((author) => author.trim()).filter(Boolean))];
    if (list.length > TAKES_AUTHORS_MAX || !list.every(isAddress)) return null;
    query.authors = list;
  }
  return query;
}

export async function GET(req: Request) {
  // An unconfigured store is an expected state, not a failure: the reel carries
  // markets alone and the composer says what is missing.
  if (!isDbConfigured()) return NextResponse.json({ configured: false, takes: [] } satisfies TakesFeed);

  const query = feedQuery(new URL(req.url).searchParams);
  if (!query) return refuse(TAKE_ERRORS.badRequest, 400);
  const rows = await listTakes(query);
  if (rows === null) return refuse(TAKE_ERRORS.unavailable, 503);
  return NextResponse.json({ configured: true, takes: rows.map(toFeedTake) } satisfies TakesFeed, { headers: { "Cache-Control": FEED_CACHE } });
}

export async function POST(req: Request) {
  if (!isDbConfigured()) return refuse(TAKE_ERRORS.unavailable, 503);

  const parsed = takePostRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return refuse(TAKE_ERRORS.badRequest, 400);
  const { marketId, side, caption, address, issuedAtMs, signature } = parsed.data;

  const now = Date.now();
  if (Math.abs(now - issuedAtMs) > TAKE_SIGNATURE_TTL_MS) return refuse(TAKE_ERRORS.staleSignature, 400);
  if (!(await verifyTakeSignature({ marketId, side, caption, address, issuedAtMs, signature }))) return refuse(TAKE_ERRORS.badSignature, 401);
  // Counted only once the wallet is proven, so nobody can spend another wallet's budget.
  if (!ROOM_LIMITS.take.take(address, now)) return refuse(TAKE_ERRORS.rateLimited, 429);

  // The Window's facts come from the venue, never from the request body — a client
  // that could name its own line could post a call about a number that never printed.
  ensureMarkets(parseMarketsEnv());
  const reading = await marketsProvider.getMarket(marketId);
  if (!reading.ok) return refuse(TAKE_ERRORS.gateUnreadable, 503);
  const market = reading.value;
  if (!market) return refuse(TAKE_ERRORS.noWindow, 404);
  if (secToMs(market.expirySec) <= now) return refuse(TAKE_ERRORS.windowClosed, 409);

  let backed: boolean;
  try {
    backed = await holdsPosition(address, marketId);
  } catch (cause) {
    // Not "you hold nothing" — an unreadable gate would then stamp a bettor's call
    // "open call", which is the wrong badge for the wrong reason.
    if (!(cause instanceof GateUnreadableError)) throw cause;
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
    tags: parseCashtags(caption, market.asset),
  });
  if (row === null) return refuse(TAKE_ERRORS.unavailable, 503);
  return NextResponse.json({ take: toFeedTake(row) }, { headers: { "Cache-Control": "no-store" } });
}
