import { ENTRY_BUFFER_SEC } from "../constants/timing";
import { secToMs } from "../units/time";

/** The same 30-second entry buffer for every cadence and execution surface. */
export function headroomSec(_intervalSec: number): number {
  return ENTRY_BUFFER_SEC;
}

/** The instant entry closes: expiry less the headroom — the one definition every surface and the order lane share. */
export function noEntryCutoffSec(expirySec: number, intervalSec: number): number {
  return expirySec - headroomSec(intervalSec);
}

export function noEntryCutoffMs(expirySec: number, intervalSec: number): number {
  return secToMs(noEntryCutoffSec(expirySec, intervalSec));
}

export function insideNoEntryBuffer(nowMs: number, expirySec: number, intervalSec: number): boolean {
  return nowMs >= noEntryCutoffMs(expirySec, intervalSec);
}

/**
 * Expiry for a taker order: a dead-man's switch one headroom past now, never beyond the market (canon #6).
 * Null inside the no-entry buffer — there is no admissible expiry to send.
 */
export function orderExpirySec(nowSec: number, expirySec: number, intervalSec: number): number | null {
  if (nowSec >= noEntryCutoffSec(expirySec, intervalSec)) return null;
  return Math.min(expirySec, nowSec + headroomSec(intervalSec));
}
