"use client";

import { computeDrift, formatCadence, type Drift } from "@masayume/core/market";
import type { EventMarket, LaneSet } from "@masayume/core/types";
import { useMemo } from "react";
import { type ChartPoint, useChartSeries } from "../markets/hero/useChartSeries";
import { useTopOfBook } from "../markets/hero/useTopOfBook";
import type { SenseiSnapshot } from "./protocol";
import { oracleToWholeUsd } from "./units";

/** The reference reads the four nearest markets (`SenseiDock.tsx` L138). */
const NEAREST = 4;
/** The reference's flat band is a hardcoded $3 on BTC; as a fraction it holds for any asset. */
const FLAT_BAND_FRACTION = 0.00004;
const DRIFT_WINDOW_MIN = 15;
/** Sensei is told the market set twice a minute and the figures once — not 60 times. */
const MEMBERSHIP_TICK_MS = 30_000;
const SNAPSHOT_TICK_MS = 60_000;

export interface SenseiReading {
  snapshot: SenseiSnapshot | null;
  /** The Window the meter and the tape are about: the one closing soonest. */
  nearest: EventMarket | null;
  drift: Drift | null;
  points: readonly ChartPoint[];
  latestRaw: bigint | null;
}

/**
 * What Sensei is looking at — built from the lane set the page already holds.
 *
 * The reference fetches its own markets and spot on a 20 s poll while the drawer is
 * open, plus a second history poll inside `SenseiTape`. Both are readings `/markets`
 * is already streaming, so this takes them as arguments instead: one market stream
 * on the page, and a price Sensei quotes can never disagree with the price on the
 * card behind the drawer.
 *
 * `useTopOfBook` is called a fixed four times against a possibly-null market rather
 * than in a loop, so the hook count is constant and every Window Sensei is told
 * about carries a real book. The reference sends no odds at all — its model would
 * have had nothing to read them from.
 */
export function useSenseiSnapshot(laneSet: LaneSet | null, nowMs: number): SenseiReading {
  const membershipTick = Math.floor(nowMs / MEMBERSHIP_TICK_MS);
  const snapshotTick = Math.floor(nowMs / SNAPSHOT_TICK_MS);

  const nearestMarkets = useMemo(() => {
    if (laneSet === null) return [];
    return laneSet.lanes
      .flatMap((lane) => lane.markets)
      .filter((market) => market.expirySec * 1000 > nowMs)
      .sort((a, b) => a.expirySec - b.expirySec)
      .slice(0, NEAREST);
    // Keyed on the membership tick, not `nowMs`: re-deriving every second would hand
    // every consumer a new array once a second and remount the tape with it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laneSet, membershipTick]);

  const nearest = nearestMarkets[0] ?? null;
  const books = [
    useTopOfBook(nearestMarkets[0] ?? null),
    useTopOfBook(nearestMarkets[1] ?? null),
    useTopOfBook(nearestMarkets[2] ?? null),
    useTopOfBook(nearestMarkets[3] ?? null),
  ];

  const series = useChartSeries(nearest);
  const points = nearest !== null && series?.ok ? series.value.points : [];
  const latestRaw = points.at(-1)?.valueRaw ?? null;

  const drift = useMemo(() => {
    if (latestRaw === null) return null;
    const band = BigInt(Math.max(1, Math.round(Number(latestRaw) * FLAT_BAND_FRACTION)));
    return computeDrift(points, DRIFT_WINDOW_MIN, band);
  }, [points, latestRaw]);

  const cents = books.map((book) => `${book.upCents}/${book.downCents}`).join(",");
  const snapshot = useMemo<SenseiSnapshot | null>(() => {
    if (nearestMarkets.length === 0 || nowMs === 0) return null;
    const priceUsd: Record<string, number> = {};
    const latest = oracleToWholeUsd(latestRaw);
    if (nearest !== null && latest !== null) priceUsd[nearest.asset] = latest;

    return {
      priceUsd,
      markets: nearestMarkets.map((market, index) => ({
        asset: market.asset,
        cadence: formatCadence(market.intervalSec),
        minsToClose: Math.max(0, Math.round((market.expirySec * 1000 - nowMs) / 60_000)),
        lineUsd: oracleToWholeUsd(market.openingPriceRaw),
        upCents: books[index]?.upCents ?? null,
        downCents: books[index]?.downCents ?? null,
      })),
    };
    // `cents` is the books' values flattened to a string, so an unchanged book holds
    // the snapshot's identity instead of rebuilding it behind four object identities.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nearestMarkets, latestRaw, nearest, snapshotTick, cents]);

  return { snapshot, nearest, drift, points, latestRaw };
}
