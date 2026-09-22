import { etDateOf, etMinutesOf, weekdayOfDate } from "@agari/core/market";

/** "this weekend" · "this session" · "tonight": the span the hedge Window covers, in the card's own words. */
export type HedgeHorizon = "weekend" | "session" | "overnight";

const FRIDAY = 4;
const SESSION_CLOSE_MIN = 16 * 60;

/** A token Window outside the session hedges the weekend from Friday's close to Sunday, otherwise the night. */
export function tokenHorizon(nowSec: number): HedgeHorizon {
  const weekday = weekdayOfDate(etDateOf(nowSec));
  return weekday > FRIDAY || (weekday === FRIDAY && etMinutesOf(nowSec) >= SESSION_CLOSE_MIN) ? "weekend" : "overnight";
}
