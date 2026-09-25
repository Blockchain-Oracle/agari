import { isTickerSymbol, type TickerSymbol } from "@agari/core/market";
import type { Address } from "@agari/core/types";
import { getDb, listTakes, socialActivityReader, type SocialActivityReader, type TakeRecord } from "@agari/db";
import type { FeedTake } from "@/features/takes/protocol";
import { fillItem, mergeItems, settlementItems, takeItem } from "./items";
import { ACTIVITY_LIMIT, type ActivityFeed, type ActivityItem } from "./protocol";

/**
 * The two activity feeds, server-side (spec §1.6, §3). Index data is public, so neither needs a session: the inbox
 * is "what happened to this wallet", and a ticker hub is "the calls, verdicts and tagged takes on this ticker". Each
 * is one fills query, one settlements query and (for the ticker hub) one takes query, run together and merged newest
 * first.
 */

let reader: SocialActivityReader | null = null;

function activityReader(): SocialActivityReader | null {
  const db = getDb();
  if (!db) return null;
  reader ??= socialActivityReader(db);
  return reader;
}

const UNCONFIGURED: ActivityFeed = { configured: false, items: [], takes: [] };

/** `GET /api/takes`'s own row shape, so a take row here reads exactly as it does on the reel. */
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

/** Merges the groups and keeps only the takes a surviving row names. */
function feedOf(groups: ActivityItem[][], takeRows: TakeRecord[] | null = null): ActivityFeed {
  const takes = (takeRows ?? []).map(toFeedTake);
  const items = mergeItems([...groups, takes.map(takeItem)], ACTIVITY_LIMIT);
  const named = new Set(items.flatMap((item) => (item.takeId ? [item.takeId] : [])));
  return { configured: true, items, takes: takes.filter((take) => named.has(take.id)) };
}

/** The wallet's own fills (either seat), verdicts, claimable payouts and crank payouts. */
export async function inboxFeed(wallet: Address, sinceSec?: number): Promise<ActivityFeed> {
  const r = activityReader();
  if (!r) return UNCONFIGURED;
  const q = { sinceSec, limit: ACTIVITY_LIMIT };
  const [fills, settlements] = await Promise.all([r.walletFills([wallet], q), r.walletSettlements([wallet], q)]);
  return feedOf([fills.map(fillItem), settlements.flatMap((row) => settlementItems(row, { payouts: true }))]);
}

/** A ticker hub: the calls on its Windows, the verdicts of the wallets that made them, and takes tagged `$SYM`. */
export async function tickerFeed(symbol: TickerSymbol): Promise<ActivityFeed> {
  const r = activityReader();
  if (!r) return UNCONFIGURED;
  const q = { limit: ACTIVITY_LIMIT };
  const [fills, settlements, takes] = await Promise.all([r.tickerFills(symbol, q), r.tickerSettlements(symbol, q), listTakes({ limit: ACTIVITY_LIMIT, symbol })]);
  return feedOf([fills.map(fillItem), settlements.flatMap((row) => settlementItems(row, { payouts: false }))], takes);
}
