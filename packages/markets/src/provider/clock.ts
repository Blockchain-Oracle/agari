import type { ClockSync } from "@masayume/core/types";
import { msToSec } from "@masayume/core/units";

let offsetMs = 0;
let lastSync: ClockSync | null = null;

/** Chain-offset-corrected wall clock. Raw device time never drives a phase (Story 1.3 AC). */
export function nowMs(): number {
  return Date.now() + offsetMs;
}

export function nowSec(): number {
  return msToSec(nowMs());
}

export function applyClockSync(sync: ClockSync): void {
  offsetMs = sync.offsetMs;
  lastSync = sync;
}

export function lastClockSync(): ClockSync | null {
  return lastSync;
}
