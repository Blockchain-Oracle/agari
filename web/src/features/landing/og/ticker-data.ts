import { formatEtClock, type TickerSymbol, type TradingSession } from "@agari/core/market";
import { getDb, indexReader } from "@agari/db";
import { z } from "zod";
import { archiveKeys } from "@/app/api/index/[...path]/queries-archive";
import { webEnv } from "@/lib/env";
import { dayChange, formatDayChange, type DayChangeText } from "../../markets/asset-history/day-change";
import { archiveWindow } from "../../markets/asset-history/range";
import { FEED_DECIMALS_DEFAULT, feedRawToOracleRaw, usdLine } from "../../markets/hero/units";
import { etWeekday } from "../../markets/lanes/lane-view";
import { withinBudget } from "./read-budget";

/**
 * A ticker's last close for its link preview, read on the server from the same two sources the closed hero reads in the
 * browser (D-086): ops `/session` for the calendar, the index's signed 5-minute archive for the closes. No data-provider
 * key is touched. Any failure or a slow answer yields null, and the card renders without a price.
 */

/** The archive holds two sessions of 5-minute boundaries: 79 rows each. */
const ARCHIVE_ROWS = 200;
/** The calendar turns over at a bell; the image route itself revalidates on the same five minutes. */
const SESSION_REVALIDATE_SEC = 300;

const sessionSchema = z.object({ date: z.string(), openSec: z.number(), closeSec: z.number(), earlyClose: z.boolean() });
const bodySchema = z.object({
  status: z.object({ session: sessionSchema.nullable() }).passthrough().nullable(),
  calendar: z.object({ upcoming: z.array(sessionSchema), recent: z.array(sessionSchema).default([]) }).passthrough().nullable(),
});

export interface TickerClose {
  /** "$356.59" */
  price: string;
  /** "Tue 16:00" */
  when: string;
  change: DayChangeText | null;
}

interface Close {
  sec: number;
  priceRaw: bigint;
}

async function readSessions(): Promise<TradingSession[] | null> {
  const base = webEnv.markets.priceFeedUrl;
  if (!base) return null;
  const response = await fetch(`${base}/session`, { next: { revalidate: SESSION_REVALIDATE_SEC } });
  if (!response.ok) return null;
  const body = bodySchema.parse(await response.json());
  if (!body.calendar) return null;
  const byDate = new Map<string, TradingSession>();
  for (const s of [...body.calendar.recent, ...(body.status?.session ? [body.status.session] : []), ...body.calendar.upcoming]) byDate.set(s.date, s);
  return [...byDate.values()];
}

/** The row at the session's close, else the last row inside it: `useDailyCloses`' rule, on rows the server reads itself. */
function closeOf(rows: readonly Close[], session: TradingSession | null): Close | null {
  if (!session) return null;
  const inside = rows.filter((r) => r.sec >= session.openSec && r.sec <= session.closeSec);
  return inside.find((r) => r.sec === session.closeSec) ?? inside.at(-1) ?? null;
}

async function readClose(symbol: TickerSymbol): Promise<TickerClose | null> {
  const db = getDb();
  const sessions = await readSessions();
  if (!db || !sessions) return null;
  const window = archiveWindow(sessions, Math.floor(Date.now() / 1000));
  if (!window) return null;
  const raw = await indexReader(db).printArchiveSeries(archiveKeys(symbol), window.fromSec, window.toSec, ARCHIVE_ROWS);
  const rows = raw.map((row) => ({ sec: Number(row.boundary_sec), priceRaw: feedRawToOracleRaw(BigInt(String(row.price_e8)), FEED_DECIMALS_DEFAULT) }));
  const last = closeOf(rows, window.session);
  if (!last) return null;
  const change = dayChange(last.priceRaw, last.sec, { last, prev: closeOf(rows, window.prev) });
  return { price: usdLine(last.priceRaw), when: `${etWeekday(last.sec)} ${formatEtClock(last.sec)}`, change: change ? formatDayChange(change) : null };
}

export function readTickerClose(symbol: TickerSymbol): Promise<TickerClose | null> {
  return withinBudget(readClose(symbol));
}
