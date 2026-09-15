/** What an S6 relay lane pass reports back to `relay-pass.ts` (session-lanes.md §1.5, §2.4): a log line and its next wake. */
export interface LanePassResult {
  /** Null when the pass had nothing to say. */
  line: string | null;
  /** The next wall-clock second this lane needs a pass (clamped by the relay to [1, 15] s); null for no preference. */
  nextSec: number | null;
}

export const NOT_BUILT = (lane: string, count: number): LanePassResult => ({ line: count ? `${lane}: ${count} slot(s), lane not built` : null, nextSec: null });
