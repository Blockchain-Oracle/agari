"use client";

import { AreaSeries, ColorType, CrosshairMode, LineStyle, createChart, type IChartApi, type ISeriesApi, type UTCTimestamp } from "lightweight-charts";
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

/**
 * The desk's value chart (S22, D-127): 21st's Portfolio Chart (#29532) layout, drawn with the lightweight-charts the
 * market hero already ships, so no second chart library. Values arrive as dollars; floats exist only at the canvas.
 */
export interface AreaPoint {
  timeSec: number;
  value: number;
}

function cssVar(el: HTMLElement, name: string): string {
  return getComputedStyle(el).getPropertyValue(name).trim() || "currentColor";
}

/** The canvas needs a resolved family list: `--font-data` holds a `var()` chain the canvas cannot read. */
function resolvedFont(el: HTMLElement, name: string): string {
  const probe = document.createElement("span");
  probe.style.fontFamily = `var(${name})`;
  el.appendChild(probe);
  const family = getComputedStyle(probe).fontFamily;
  probe.remove();
  return family || "ui-monospace, monospace";
}

/** `tone` picks the line: profit when the range ends above where it started, loss below, ink when flat. */
export function AreaChartClient({ points, baseline, tone, className }: { points: readonly AreaPoint[]; baseline: number | null; tone: "up" | "down" | "flat"; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const built = useRef<{ chart: IChartApi; series: ISeriesApi<"Area"> } | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = createChart(el, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: cssVar(el, "--color-ink-muted"), fontFamily: resolvedFont(el, "--font-data"), attributionLogo: false },
      grid: { vertLines: { visible: false }, horzLines: { color: cssVar(el, "--color-hairline") } },
      rightPriceScale: { borderVisible: false, scaleMargins: { top: 0.18, bottom: 0.08 } },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      crosshair: { mode: CrosshairMode.Magnet, vertLine: { labelVisible: false, style: LineStyle.Dotted }, horzLine: { style: LineStyle.Dotted } },
      handleScroll: false,
      handleScale: false,
    });
    const series = chart.addSeries(AreaSeries, { lineWidth: 2, priceLineVisible: false, lastValueVisible: true, priceFormat: { type: "price", precision: 2, minMove: 0.01 } });
    built.current = { chart, series };
    return () => {
      chart.remove();
      built.current = null;
    };
  }, []);

  useEffect(() => {
    const b = built.current;
    const el = ref.current;
    if (!b || !el) return;
    const color = cssVar(el, tone === "up" ? "--color-profit" : tone === "down" ? "--color-loss" : "--color-ink");
    b.series.applyOptions({ lineColor: color, topColor: `color-mix(in srgb, ${color} 28%, transparent)`, bottomColor: "transparent" });
    b.series.setData(points.map((p) => ({ time: p.timeSec as UTCTimestamp, value: p.value })));
    for (const line of b.series.priceLines()) b.series.removePriceLine(line);
    if (baseline !== null) b.series.createPriceLine({ price: baseline, color: cssVar(el, "--color-ink-muted"), lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
    b.chart.timeScale().fitContent();
  }, [points, baseline, tone]);

  return <div ref={ref} className={cn("h-52 w-full", className)} />;
}
