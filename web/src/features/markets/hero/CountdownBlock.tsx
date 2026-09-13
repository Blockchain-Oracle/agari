"use client";

import { countdown } from "@masayume/core/lifecycle";
import { Countdown, CountdownRing } from "@/components/data";

interface CountdownBlockProps {
  expirySec: number;
  intervalSec: number;
  /** Chain-corrected clock; 0 before the first client tick. */
  nowMs: number;
}

/** The hero's ring is the one glowing element on the screen, and only while urgent (glow law). */
export function CountdownBlock({ expirySec, intervalSec, nowMs }: CountdownBlockProps) {
  const state = nowMs > 0 ? countdown(nowMs, expirySec, intervalSec) : null;
  return (
    <CountdownRing fraction={state?.fraction ?? 1} urgent={state?.urgent ?? false} glow className="size-28 shrink-0">
      <Countdown expirySec={expirySec} intervalSec={intervalSec} nowMs={nowMs} announce className="type-data-lg" />
    </CountdownRing>
  );
}
