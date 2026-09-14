"use client";

import { sessionLabel, sessionStatus, type SessionCalendar, type SessionStatus, type TradingSession } from "@agari/core/market";
import { err, ok, type Reading } from "@agari/core/schemas";
import { diagnosis } from "@agari/core/types";
import { marketsProvider } from "@agari/markets";
import { useReadingQuery } from "@agari/markets/react";
import { z } from "zod";
import { webEnv } from "@/lib/env";

/** first-call.md §6: the chip polls ops once a minute; a label only turns over at a session boundary. */
const SESSION_POLL_MS = 60_000;
const SESSION_KEY = ["agari", "ops", "session"] as const;

const sessionSchema = z.object({ date: z.string(), openSec: z.number(), closeSec: z.number(), earlyClose: z.boolean() });

/** The ops `GET /session` body (`services/ops/src/http/session.ts`); lanes are keyed `"<TICKER>-<cadence>"`. */
const bodySchema = z.object({
  nowSec: z.number(),
  status: z.object({ session: sessionSchema.nullable() }).passthrough().nullable(),
  calendar: z
    .object({ fromDate: z.string(), toDate: z.string(), unknownDates: z.array(z.string()), upcoming: z.array(sessionSchema) })
    .nullable(),
  lanes: z.record(z.string(), z.string()),
});

type SessionBody = z.infer<typeof bodySchema>;

export interface MarketSession {
  /** Recomputed at read time from the agreed calendar, so a boundary turns over without waiting on the poll. */
  status: SessionStatus;
  /** "Closes 16:00 ET", "Opens Tue 09:30 ET", "Trading halted", or "Closed". */
  label: string;
  /** True in regular hours (early close included): the only state in which Regular Windows run. */
  open: boolean;
  /** Roller lane states: `open #22 …`, `paused: no signed source`, `closed: no session`. */
  lanes: Readonly<Record<string, string>>;
}

async function readSession(): Promise<Reading<SessionBody>> {
  const base = webEnv.markets.priceFeedUrl;
  if (!base) return err(diagnosis("indexer-down", "NEXT_PUBLIC_PRICE_FEED_URL is not set; the session read has no ops base"));
  const response = await fetch(`${base}/session`, { cache: "no-store" });
  if (!response.ok) return err(diagnosis("indexer-down", `ops /session answered ${response.status}`));
  return ok(bodySchema.parse(await response.json()), marketsProvider.nowMs());
}

/** Today's session (kept even once it has closed) and the upcoming ones: every date the core rules will ask about. */
function calendarOf(body: SessionBody): SessionCalendar | null {
  if (!body.calendar) return null;
  const today: TradingSession[] = body.status?.session ? [body.status.session] : [];
  const sessions = [...today, ...body.calendar.upcoming.filter((s) => s.date !== body.status?.session?.date)];
  return { fromDate: body.calendar.fromDate, toDate: body.calendar.toDate, unknownDates: body.calendar.unknownDates, sessions };
}

/** The roller's word for one ticker lane. Its key counts minutes (`TSLA-60m`), not `formatCadence`'s `1h`. */
export function laneState(session: MarketSession | null, asset: string, intervalSec: number): string | null {
  return session?.lanes[`${asset}-${intervalSec / 60}m`] ?? null;
}

/** Paused while the session is open: no signed source covers the Window, or a corporate action skips it. */
export function isLanePaused(session: MarketSession | null, asset: string, intervalSec: number): boolean {
  return laneState(session, asset, intervalSec)?.startsWith("paused") ?? false;
}

/**
 * The NYSE session as ops agrees it (Alpaca calendar cross-checked, S3), for the chip and the closed copy.
 * Null while unknown: before the first answer, when ops is unreachable, or when the calendar disputes today —
 * a surface then says nothing about hours rather than guessing them.
 */
export function useMarketSession(): MarketSession | null {
  const reading = useReadingQuery(SESSION_KEY, readSession, { pollMs: SESSION_POLL_MS, needs: [] });
  if (!reading?.ok) return null;
  const calendar = calendarOf(reading.value);
  const status = calendar ? sessionStatus(Math.floor(marketsProvider.nowMs() / 1000), calendar) : null;
  if (!status) return null;
  return {
    status,
    label: sessionLabel(status),
    open: status.state === "regular" || status.state === "early-close",
    lanes: reading.value.lanes,
  };
}
