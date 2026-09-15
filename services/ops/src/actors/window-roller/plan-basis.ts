/** The roller's basis dispatch (session-lanes.md §6): Regular `plan.ts`, Gap `plan-gap.ts` (6a), token `plan-token.ts` (6b). */
import type { LaneBasis } from "@agari/core/types";
import { planSeries, type PlanClock, type PlanSeries, type SeriesPlan } from "./plan";
import { planGapSeries } from "./plan-gap";
import { planTokenSeries } from "./plan-token";

export function planByBasis(basis: LaneBasis, series: PlanSeries, clock: PlanClock): SeriesPlan {
  if (basis === "gap") return planGapSeries(series, clock);
  if (basis === "token") return planTokenSeries(series, clock);
  return planSeries(series, clock);
}
