"use client";

import {
  ColorType,
  CrosshairMode,
  LineSeries,
  LineStyle,
  createChart,
  type AutoscaleInfo,
  type IChartApi,
  type IPriceLine,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useEffect, useRef } from "react";
import { HERO } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { ChartPoint } from "./useChartSeries";
import { ORACLE_SCALE } from "./units";

interface PriceChartClientProps {
  points: ChartPoint[];
  /** The oracle's print; null while pending — no line is drawn at a guessed level. */
  openingRaw: bigint | null;
  className?: string;
}

interface Built {
  chart: IChartApi;
  series: ISeriesApi<"Line">;
  priceLine: IPriceLine | null;
  pointCount: number;
}

/** Floats exist only here, at the canvas boundary. */
const toValue = (raw: bigint): number => Number(raw) / 10 ** ORACLE_SCALE;
const MIN_MOVE = 1 / 10 ** ORACLE_SCALE;

/**
 * Theme comes from the token surfaces at mount, never from literals in this file.
 *
 * Read off the chart's own container, not the document root: `/reels` is a dark island
 * that keeps its black card in light mode, so it scopes surface-appropriate ink on
 * `.reel-card`. Reading from the root would hand that card the page's near-black ink
 * and draw an invisible line on it.
 */
function cssVar(el: HTMLElement, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || "currentColor";
}

function buildChart(container: HTMLDivElement): Built {
  const chart = createChart(container, {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: "transparent" },
      textColor: cssVar(container, "--color-ink-muted"),
      fontFamily: cssVar(container, "--font-data"),
      attributionLogo: false,
    },
    grid: { vertLines: { visible: false }, horzLines: { color: cssVar(container, "--color-hairline") } },
    rightPriceScale: { borderVisible: false },
    timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
    crosshair: { mode: CrosshairMode.Hidden },
    handleScroll: false,
    handleScale: false,
  });
  const series = chart.addSeries(LineSeries, {
    color: cssVar(container, "--color-ink"),
    lineWidth: 2,
    priceLineVisible: false,
    lastValueVisible: true,
    priceFormat: { type: "price", precision: ORACLE_SCALE, minMove: MIN_MOVE },
  });
  return { chart, series, priceLine: null, pointCount: 0 };
}

/** Keeps the opening print inside the visible range; the series alone would autoscale it out of view. */
function includeInAutoscale(series: ISeriesApi<"Line">, price: number): void {
  series.applyOptions({
    autoscaleInfoProvider: (original: () => AutoscaleInfo | null) => {
      const info = original();
      if (!info?.priceRange) return info;
      const { minValue, maxValue } = info.priceRange;
      return { ...info, priceRange: { minValue: Math.min(minValue, price), maxValue: Math.max(maxValue, price) } };
    },
  });
}

export function PriceChartClient({ points, openingRaw, className }: PriceChartClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const builtRef = useRef<Built | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const built = buildChart(containerRef.current);
    builtRef.current = built;
    return () => {
      built.chart.remove();
      builtRef.current = null;
    };
  }, []);

  useEffect(() => {
    const built = builtRef.current;
    if (!built) return;
    const data = points.map((p) => ({ time: p.timeSec as UTCTimestamp, value: toValue(p.valueRaw) }));
    const last = data.at(-1);
    if (last && data.length === built.pointCount + 1) {
      built.series.update(last);
    } else {
      built.series.setData(data);
      built.chart.timeScale().fitContent();
    }
    built.pointCount = data.length;
  }, [points]);

  useEffect(() => {
    const built = builtRef.current;
    const container = containerRef.current;
    if (!built || !container || openingRaw === null || built.priceLine) return;
    const price = toValue(openingRaw);
    includeInAutoscale(built.series, price);
    built.priceLine = built.series.createPriceLine({
      price,
      color: cssVar(container, "--color-ink-secondary"),
      lineWidth: 1,
      lineStyle: LineStyle.Solid,
      axisLabelVisible: true,
      title: HERO.openingPrint,
    });
  }, [openingRaw]);

  return <div ref={containerRef} className={cn("h-56 w-full", className)} />;
}
