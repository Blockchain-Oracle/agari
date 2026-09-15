"use client";

import type { TickerSymbol } from "@agari/core/market";
import type { Reading } from "@agari/core/schemas";
import type { PricePoint } from "@agari/core/types";
import { getArchiveSeries, marketsProvider } from "@agari/markets";
import { keys, useReadingQuery } from "@agari/markets/react";
import { useMemo } from "react";
import { basisRaw, FEED_DECIMALS_DEFAULT, feedRawToOracleRaw } from "../hero/units";
import type { MarketSession } from "../session";
import { archiveStaleMs, archiveWindow, type ArchiveWindow } from "./range";

/** An unused archive entry lives half an hour, so a route change and back costs nothing (D-086). */
const GC_MS = 30 * 60_000;

/** A session's close on the oracle's display scale. */
export interface Close {
  sec: number;
  priceRaw: bigint;
}

export interface DailyCloses {
  /** The last completed session's close. */
  last: Close | null;
  /** The session before it: what a closed surface measures the day's move against. */
  prev: Close | null;
}

export interface ArchiveRead {
  window: ArchiveWindow | null;
  reading: Reading<PricePoint[]> | null;
}

/**
 * One archive read per symbol over the last two completed sessions, shared by the chart, the closes and every card.
 * The window only moves when a session closes, which is when `status.state` and `date` turn over — so it is memoized
 * on those, not on the clock, and the read's key holds all night.
 */
export function useArchiveRead(symbol: TickerSymbol | null, session: MarketSession | null, enabled = true): ArchiveRead {
  const sessions = session?.sessions ?? null;
  const state = session?.status.state ?? null;
  const date = session?.status.date ?? null;
  const window = useMemo(
    () => (sessions ? archiveWindow(sessions, Math.floor(marketsProvider.nowMs() / 1000)) : null),
    // `state` and `date` are the boundary clock: a new value means a session may have completed since the last window.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, state, date],
  );
  const fromSec = window?.fromSec ?? 0;
  const toSec = window?.toSec ?? 0;
  const reading = useReadingQuery(keys.archive(symbol, fromSec, toSec), () => getArchiveSeries(symbol as TickerSymbol, fromSec, toSec), {
    enabled: enabled && symbol !== null && window !== null,
    staleTimeMs: session ? archiveStaleMs(session.status, Math.floor(marketsProvider.nowMs() / 1000)) : undefined,
    gcTimeMs: GC_MS,
    needs: [],
  });
  return { window, reading };
}

export const toClose = (point: PricePoint): Close => ({ sec: point.publishTimeSec, priceRaw: feedRawToOracleRaw(basisRaw(point), FEED_DECIMALS_DEFAULT) });

/** The row at the session's close, else the last row inside the session (the archiver can trail the bell by a minute). */
function closeOf(rows: readonly PricePoint[], session: { openSec: number; closeSec: number } | null): Close | null {
  if (!session) return null;
  const inside = rows.filter((r) => r.publishTimeSec >= session.openSec && r.publishTimeSec <= session.closeSec);
  const at = inside.find((r) => r.publishTimeSec === session.closeSec) ?? inside.at(-1);
  return at ? toClose(at) : null;
}

/** Both closes from one archive read: pure, so the chart derives them from the rows it already holds. */
export function sessionCloses(rows: readonly PricePoint[], window: ArchiveWindow): DailyCloses {
  return { last: closeOf(rows, window.session), prev: closeOf(rows, window.prev) };
}

/**
 * Null until the archive answers; a failed read reads as no closes (the surface then shows the price alone).
 * `enabled: false` keeps the hook mounted without a read, for a surface that only needs the closes as a fallback.
 */
export function useDailyCloses(symbol: TickerSymbol | null, session: MarketSession | null, enabled = true): DailyCloses | null {
  const { window, reading } = useArchiveRead(symbol, session, enabled);
  return useMemo(() => (window && reading?.ok ? sessionCloses(reading.value, window) : null), [window, reading]);
}
