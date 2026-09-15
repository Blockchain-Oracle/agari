/**
 * What the roller does next on one 24/7 token Series (session-lanes.md §2.4): `tokenWindows` back-to-back with no
 * calendar, skipped only for multiplier changes and issuer halts. Pure, like `plan.ts`. Lane 6b owns this file; the
 * foundation stub lists nothing.
 */
import type { PlanClock, PlanSeries, SeriesPlan } from "./plan";

export function planTokenSeries(_series: PlanSeries, _clock: PlanClock): SeriesPlan {
  return { kind: "closed", wakeSec: null, state: "paused: lane not built" };
}
