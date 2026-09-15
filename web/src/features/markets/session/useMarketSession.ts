"use client";

import { haltLabel, laneKey, sessionLabel, sessionStatus, type SessionCalendar, type SessionStatus, type TickerSymbol, type TradingSession } from "@agari/core/market";
import { err, ok, type Reading } from "@agari/core/schemas";
import { diagnosis, HALT_REASONS, type CorporateSkip, type EarningsEvent, type HaltBoard, type HaltEntry, type LaneBasis } from "@agari/core/types";
import { marketsProvider } from "@agari/markets";
import { useReadingQuery } from "@agari/markets/react";
import { useRef } from "react";
import { z } from "zod";
import { webEnv } from "@/lib/env";

/** first-call.md §6: the chip polls ops once a minute; a label only turns over at a session boundary. */
const SESSION_POLL_MS = 60_000;
/** Closed and more than ten minutes from the next open, the body cannot change: poll every five minutes (S18a). */
const CLOSED_POLL_MS = 5 * 60_000;
const NEAR_BOUNDARY_SEC = 10 * 60;
const SESSION_KEY = ["agari", "ops", "session"] as const;

const sessionSchema = z.object({ date: z.string(), openSec: z.number(), closeSec: z.number(), earlyClose: z.boolean() });

/**
 * The ops `GET /session` body (`services/ops/src/http/session.ts`); lanes are keyed by core `laneKey`. The S6 fields
 * default so an ops process from before S6 still reads: no halts, earnings unknown, no skips. `calendar.recent`
 * (S5) defaults empty for the same reason.
 */
const bodySchema = z.object({
  nowSec: z.number(),
  status: z.object({ session: sessionSchema.nullable() }).passthrough().nullable(),
  calendar: z
    .object({ fromDate: z.string(), toDate: z.string(), unknownDates: z.array(z.string()), upcoming: z.array(sessionSchema), recent: z.array(sessionSchema).default([]) })
    .nullable(),
  lanes: z.record(z.string(), z.string()),
  halts: z.record(z.string(), z.object({ reason: z.enum(HALT_REASONS), sinceSec: z.number() })).default({}),
  earnings: z.array(z.object({ symbol: z.string(), dateEt: z.string(), hour: z.enum(["bmo", "amc", "dmh"]).nullable() })).nullable().default(null),
  skips: z.array(z.object({ symbol: z.string(), date: z.string(), why: z.string(), lanes: z.array(z.enum(["regular", "gap", "token"])).optional() })).default([]),
});

type SessionBody = z.infer<typeof bodySchema>;

export interface MarketSession {
  /** Recomputed at read time from the agreed calendar, so a boundary turns over without waiting on the poll. */
  status: SessionStatus;
  /** "Closes 16:00 ET", "Opens Tue 09:30 ET", "Trading halted", "Signed price stale", or "Closed". */
  label: string;
  /** True in regular hours (early close and a halt included): the only state in which Regular Windows run. */
  open: boolean;
  /** The asked-about asset's halt, whatever the hour (a token lane halts at the weekend too); null without an asset. */
  halt: HaltEntry | null;
  /** `halt !== null`: the S13c Marquee input (session-lanes.md §5). */
  halted: boolean;
  /** Roller lane states: `open #22 …`, `paused: no signed source`, `closed: no session`. */
  lanes: Readonly<Record<string, string>>;
  halts: HaltBoard;
  /** Report dates 14 days ahead; null = unknown, never "none". */
  earnings: readonly EarningsEvent[] | null;
  skips: readonly CorporateSkip[];
  /** Every session the calendar names, recent through upcoming, ascending: the archive window and the daily closes read from it (S18a). */
  sessions: readonly TradingSession[];
}

async function readSession(): Promise<Reading<SessionBody>> {
  const base = webEnv.markets.priceFeedUrl;
  if (!base) return err(diagnosis("indexer-down", "NEXT_PUBLIC_PRICE_FEED_URL is not set; the session read has no ops base"));
  const response = await fetch(`${base}/session`, { cache: "no-store" });
  if (!response.ok) return err(diagnosis("indexer-down", `ops /session answered ${response.status}`));
  return ok(bodySchema.parse(await response.json()), marketsProvider.nowMs());
}

/** The recent sessions, today's (kept even once it has closed) and the upcoming ones: every date the core rules will ask about. */
function calendarOf(body: SessionBody): SessionCalendar | null {
  if (!body.calendar) return null;
  const byDate = new Map<string, TradingSession>();
  for (const s of [...body.calendar.recent, ...(body.status?.session ? [body.status.session] : []), ...body.calendar.upcoming]) byDate.set(s.date, s);
  const sessions = [...byDate.values()].sort((a, b) => a.openSec - b.openSec);
  return { fromDate: body.calendar.fromDate, toDate: body.calendar.toDate, unknownDates: body.calendar.unknownDates, sessions };
}

/** Once a minute near a boundary or while open; every five minutes through a closed night, weekend or holiday. */
function sessionPollMs(reading: Reading<SessionBody> | null): number {
  if (!reading?.ok) return SESSION_POLL_MS;
  const calendar = calendarOf(reading.value);
  const nowSec = Math.floor(marketsProvider.nowMs() / 1000);
  const status = calendar ? sessionStatus(nowSec, calendar) : null;
  if (!status || status.state === "regular" || status.state === "early-close" || status.state === "halted") return SESSION_POLL_MS;
  return status.nextOpenSec !== null && status.nextOpenSec - nowSec <= NEAR_BOUNDARY_SEC ? SESSION_POLL_MS : CLOSED_POLL_MS;
}

/** The roller's word for one lane, keyed as ops keys it (`TSLA-60m`, `TSLA-gap`, `TSLAx-5m`). */
export function laneState(session: MarketSession | null, asset: TickerSymbol, basis: LaneBasis, intervalSec: number): string | null {
  return session?.lanes[laneKey(asset, basis, intervalSec)] ?? null;
}

/** Paused: no signed source covers the Window, a corporate action skips it, a halt holds it, or the lane isn't built. */
export function isLanePaused(session: MarketSession | null, asset: TickerSymbol, basis: LaneBasis, intervalSec: number): boolean {
  return laneState(session, asset, basis, intervalSec)?.startsWith("paused") ?? false;
}

/** The `/session` lane fields, as parsed or as a fixture writes them with core types. */
export interface SessionLaneInputs {
  lanes: Readonly<Record<string, string>>;
  halts: HaltBoard | Readonly<Record<string, HaltEntry>>;
  earnings: readonly { symbol: string; dateEt: string; hour: EarningsEvent["hour"] }[] | null;
  skips: readonly { symbol: string; date: string; why: string; lanes?: readonly LaneBasis[] }[];
}

/** The pure half of the hook, so `/dev` fixtures build the exact value a live read would. */
export function toMarketSession(body: SessionLaneInputs, calendar: SessionCalendar, nowSec: number, asset?: string): MarketSession | null {
  const halts = body.halts as HaltBoard;
  const halt = asset ? (halts[asset as keyof HaltBoard] ?? null) : null;
  const status = sessionStatus(nowSec, calendar, { halted: halt !== null });
  if (!status) return null;
  return {
    status,
    // Core `haltLabel` (Q-S6-9): "Trading halted" only for pyth-wide / issuer-halt, else "Signed price stale".
    label: status.state === "halted" && halt ? haltLabel(halt.reason) : sessionLabel(status),
    open: status.state === "regular" || status.state === "early-close" || status.state === "halted",
    halt,
    halted: halt !== null,
    lanes: body.lanes,
    halts,
    earnings: body.earnings as EarningsEvent[] | null,
    skips: body.skips as CorporateSkip[],
    sessions: calendar.sessions,
  };
}

/**
 * The NYSE session as ops agrees it (Alpaca calendar cross-checked, S3), for the chip and the closed copy. With an
 * `asset` (a ticker, or the xStock of a token Window) the session carries that asset's halt.
 * Null while unknown: before the first answer, when ops is unreachable, or when the calendar disputes today —
 * a surface then says nothing about hours rather than guessing them.
 */
export function useMarketSession(asset?: string): MarketSession | null {
  const reading = useReadingQuery(SESSION_KEY, readSession, { pollMs: sessionPollMs, staleTimeMs: SESSION_POLL_MS, needs: [] });
  // The value is rebuilt every render but handed back by identity until a fact in it changes (a poll answered, a
  // boundary passed, a halt lifted), so a consumer can memoize on the session without recomputing once a second.
  const held = useRef<{ signature: string; value: MarketSession } | null>(null);
  if (!reading?.ok) return null;
  const calendar = calendarOf(reading.value);
  const next = calendar ? toMarketSession(reading.value, calendar, Math.floor(marketsProvider.nowMs() / 1000), asset) : null;
  if (!next) return null;
  const { state, date, nextOpenSec, closesAtSec } = next.status;
  const signature = [reading.value.nowSec, asset ?? "", state, date, nextOpenSec, closesAtSec, next.label].join("|");
  if (held.current?.signature !== signature) held.current = { signature, value: next };
  return held.current.value;
}
