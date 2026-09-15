/**
 * What the roller does next on one Gap Series (session-lanes.md §1.4): the earliest `gapWindows` candidate inside
 * `gapLeadSec`, the check-bound exception, and the corporate skip on either the Friday or the Monday. Pure, like
 * `plan.ts`. Lane 6a owns this file; the foundation stub lists nothing.
 */
import type { PlanClock, PlanSeries, SeriesPlan } from "./plan";

export function planGapSeries(_series: PlanSeries, _clock: PlanClock): SeriesPlan {
  return { kind: "closed", wakeSec: null, state: "paused: lane not built" };
}
