"use client";

import type { TickerSymbol, TradingSession } from "@agari/core/market";
import { mapReading, type Reading } from "@agari/core/schemas";
import type { AssetPrice, PricePoint } from "@agari/core/types";
import { useAssetPrice } from "@agari/markets/react";
import { useMemo } from "react";
import { basisRaw, FEED_DECIMALS_DEFAULT, feedRawToOracleRaw } from "../hero/units";
import type { ChartPoint } from "../hero/useChartSeries";
import type { MarketSession } from "../session";
import type { HistoryRange } from "./range";
import { sessionCloses, useArchiveRead, type Close } from "./useDailyCloses";

/** A closed surface polls `/prices/latest` once a minute (D-086): nothing moves faster than that off-hours. */
export const CLOSED_POLL_MS = 60_000;

export interface AssetHistory {
  range: HistoryRange;
  /** The last completed session's signed 5-minute prints, then the live tick when it is newer and has moved. */
  points: ChartPoint[];
  latest: ChartPoint | null;
  lastClose: Close | null;
  /** The reference line: the previous session's close, else the session's own open when the archive starts here. */
  prevClose: Close | null;
  /** True when `prevClose` is the session's open standing in for a previous close the archive never held. */
  lineIsOpen: boolean;
  session: TradingSession;
  /** The live reading's own time, when the latest point is the live tick rather than an archived print. */
  liveSec: number | null;
}

const toPoint = (p: PricePoint | AssetPrice, decimals = FEED_DECIMALS_DEFAULT): ChartPoint => ({
  timeSec: p.publishTimeSec,
  valueRaw: feedRawToOracleRaw(basisRaw(p), decimals),
});

/**
 * The 1D history of an asset with no Window (D-086): our signed archive for the last regular session plus the live
 * tick. A tick that repeats the close (RedStone republishes it overnight) adds nothing and is not drawn; a moved
 * pre-market or after-hours price is. Aged readings are never flagged stale here: a closed surface says "last close".
 *
 * `useAssetPrice` re-evaluates its age every second and hands back a fresh reading each time; the series is keyed on
 * the tick's own value and time, so the chart's data is rebuilt only when a print actually changes.
 */
export function useAssetHistory(symbol: TickerSymbol | null, session: MarketSession | null, range: HistoryRange = "1D"): Reading<AssetHistory> | null {
  const { window, reading } = useArchiveRead(symbol, session);
  const live = useAssetPrice(symbol, { pollMs: CLOSED_POLL_MS });
  const tickValue = live?.ok && live.value ? live.value : null;
  const tickRaw = tickValue ? feedRawToOracleRaw(basisRaw(tickValue), tickValue.decimals) : null;
  const tickSec = tickValue?.publishTimeSec ?? null;
  return useMemo(() => {
    if (!window || reading === null) return null;
    return mapReading(reading, (rows) => {
      const closes = sessionCloses(rows, window);
      const inSession = rows.filter((r) => r.publishTimeSec >= window.session.openSec && r.publishTimeSec <= window.session.closeSec).map((r) => toPoint(r));
      const tick = tickRaw !== null && tickSec !== null ? { timeSec: tickSec, valueRaw: tickRaw } : null;
      const last = inSession.at(-1);
      const moved = tick !== null && (!last || (tick.timeSec > last.timeSec && tick.valueRaw !== last.valueRaw));
      const points = moved ? [...inSession, tick] : inSession;
      const open = inSession[0] ?? null;
      const prevClose = closes.prev ?? (open ? { sec: open.timeSec, priceRaw: open.valueRaw } : null);
      return {
        range,
        points,
        latest: points.at(-1) ?? null,
        lastClose: closes.last,
        prevClose,
        lineIsOpen: closes.prev === null && prevClose !== null,
        session: window.session,
        liveSec: moved ? tick.timeSec : null,
      };
    });
  }, [window, reading, tickRaw, tickSec, range]);
}
