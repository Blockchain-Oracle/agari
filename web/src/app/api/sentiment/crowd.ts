import type { Db } from "@agari/db";
import type { SentimentReading } from "@/features/news/protocol";

/** Spec §1.5 (Q-S13-1): the last hour of taker flow; below 20 fills the share is not a reading. */
export const CROWD_WINDOW_SEC = 3_600;
export const CROWD_MIN_FILLS = 20;

const BPS = 10_000n;

/**
 * Up = the taker bought Up or sold Down; Down = the taker bought Down or sold Up (`submitter/order-codes.ts`
 * ORDER_KIND: buyYes 0, sellYes 1, buyNo 2, sellNo 3). Lots are summed as NUMERIC and read back as decimal strings.
 */
export async function readCrowd(sql: Db, nowSec: number): Promise<SentimentReading> {
  const sinceSec = nowSec - CROWD_WINDOW_SEC;
  const [row] = await sql<{ fills: number; up_lots: string; down_lots: string }[]>`
    SELECT count(*)::int AS fills,
      COALESCE(sum(lots) FILTER (WHERE taker_kind IN (0, 3)), 0)::text AS up_lots,
      COALESCE(sum(lots) FILTER (WHERE taker_kind IN (1, 2)), 0)::text AS down_lots
    FROM idx_fills WHERE ts_sec >= ${sinceSec}`;
  const fills = row?.fills ?? 0;
  const up = BigInt(row?.up_lots ?? "0");
  const total = up + BigInt(row?.down_lots ?? "0");
  // Integer bps, rounded half up: (up × 10⁴ + total/2) / total.
  const upBps = fills >= CROWD_MIN_FILLS && total > 0n ? Number((up * BPS * 2n + total) / (total * 2n)) : null;
  return { upBps, fills, windowSec: CROWD_WINDOW_SEC, asOfSec: nowSec };
}
