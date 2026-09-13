"use client";

import { countdown } from "@masayume/core/lifecycle";
import { Countdown } from "@/components/data";
import { HERO_HEAD } from "@/lib/copy";
import { cn } from "@/lib/utils";

interface HeroSettlesInProps {
  expirySec: number;
  intervalSec: number;
  /** Chain-corrected clock; 0 before the first client tick. */
  nowMs: number;
}

/**
 * The clock, and the whole block flipping vermilion as it runs out.
 *
 * Yosuku hardcodes a 60-second threshold. `countdown` scales urgency with the
 * cadence instead (`urgentAtSec`), which is the same intent held to a lane length
 * a flat minute would misread — a 1-day Window is not calm at 61 seconds.
 */
export function HeroSettlesIn({ expirySec, intervalSec, nowMs }: HeroSettlesInProps) {
  const state = nowMs > 0 ? countdown(nowMs, expirySec, intervalSec) : null;
  return (
    <div className={cn("mh-settles", state?.urgent && "urgent")}>
      <span className="mh-settles-label">{HERO_HEAD.settlesIn}</span>
      <Countdown expirySec={expirySec} intervalSec={intervalSec} nowMs={nowMs} announce className="mh-settles-value" />
    </div>
  );
}
