"use client";

import { mark, milestones, subscribeMilestones } from "@masayume/markets/perf";
import { useReportWebVitals } from "next/web-vitals";
import { useEffect } from "react";

/** What a measurement run reads out of the page. Kept deliberately small and identity-free. */
export interface PerfSnapshot {
  milestones: ReturnType<typeof milestones>;
  vitals: Record<string, number>;
  paintMs: Record<string, number>;
}

declare global {
  interface Window {
    /** Read by the measurement driver; never sent anywhere by the app itself. */
    __masayumePerf?: () => PerfSnapshot;
  }
}

const vitals: Record<string, number> = {};

function paintMs(): Record<string, number> {
  if (typeof performance === "undefined") return {};
  const out: Record<string, number> = {};
  for (const entry of performance.getEntriesByType("paint")) out[entry.name] = Math.round(entry.startTime);
  const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (nav) {
    out.ttfb = Math.round(nav.responseStart);
    out.domContentLoaded = Math.round(nav.domContentLoadedEventEnd);
  }
  return out;
}

/**
 * The read-path probe.
 *
 * It measures and publishes; it never decides anything. `shell.ready` is marked from the
 * first client effect — the server-rendered shell has painted by then, so this is the moment
 * the shell is both visible and interactive, which is the number a user actually feels.
 *
 * Nothing is transmitted. The snapshot is exposed on `window` for a measurement run to read,
 * and it carries stage names and timings only — no address, key, token or payload.
 */
export function PerfProbe() {
  useReportWebVitals((metric) => {
    vitals[metric.name] = Math.round(metric.value);
  });

  useEffect(() => {
    mark("shell.ready");
    window.__masayumePerf = () => ({ milestones: milestones(), vitals: { ...vitals }, paintMs: paintMs() });
    return subscribeMilestones(() => undefined);
  }, []);

  return null;
}
