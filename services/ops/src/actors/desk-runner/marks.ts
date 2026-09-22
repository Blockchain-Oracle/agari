/**
 * Hourly PreStocks marks for all eight names (plan §8 C4): the durable history grading reads a day later and the hub
 * sparkline reads. One row per (name, hour), from the feed's newest read; a restart mid-hour keeps the earlier row.
 */
import { PRE_IPO_SYMBOLS } from "@agari/core/market";
import type { RunnerContext } from "./types";

export const hourSlotSec = (nowSec: number): number => Math.floor(nowSec / 3600) * 3600;

let markedHourSec = 0;

/** Records this hour's marks once per process hour; returns how many names were written. */
export async function recordMarks(ctx: RunnerContext, nowSec: number): Promise<number> {
  const hourSec = hourSlotSec(nowSec);
  if (hourSec === markedHourSec) return 0;
  let written = 0;
  for (const symbol of PRE_IPO_SYMBOLS) {
    const latest = ctx.feed.history(symbol).at(-1);
    if (!latest || latest.fetchedAtSec < hourSec - 3600) continue;
    await ctx.q.upsertPriceMark({ symbol, atSec: hourSec, tokenE8: latest.tokenPriceE8.toString(), markE8: latest.markPriceE8.toString() });
    written += 1;
  }
  if (written === PRE_IPO_SYMBOLS.length) markedHourSec = hourSec;
  return written;
}
