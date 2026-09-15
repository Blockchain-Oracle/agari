import { usdLine } from "../hero/units";
import type { Close, DailyCloses } from "./useDailyCloses";

export interface DayChange {
  deltaRaw: bigint;
  /** Integer basis points of the reference close; the sign is the direction. */
  bps: number;
  /**
   * `close`: an extended-hours price measured from the last close. `prevClose`: the session itself, close over close.
   * `open`: the session from its own open, when the archive holds no previous close to measure from.
   */
  since: "close" | "prevClose" | "open";
  sinceSec: number;
  referenceRaw: bigint;
}

/**
 * The day's move for a price against the archived closes (D-086), integer arithmetic only. A tick newer than the last
 * close that differs from it is extended-hours trade, so it measures from the close; a tick that repeats the close
 * (RedStone republishes it overnight), or the archived close itself, measures the session from the previous close —
 * or, when the archive starts with this session, from its open.
 */
export function dayChange(priceRaw: bigint, priceSec: number, closes: DailyCloses, open: Close | null = null): DayChange | null {
  const extended = closes.last !== null && priceSec > closes.last.sec && priceRaw !== closes.last.priceRaw;
  const reference = extended ? closes.last : (closes.prev ?? open);
  if (!reference || reference.priceRaw <= 0n) return null;
  const since: DayChange["since"] = extended ? "close" : closes.prev ? "prevClose" : "open";
  const deltaRaw = priceRaw - reference.priceRaw;
  return { deltaRaw, bps: Number((deltaRaw * 10_000n) / reference.priceRaw), since, sinceSec: reference.sec, referenceRaw: reference.priceRaw };
}

export interface DayChangeText {
  /** "−$3.12", "+$0.48", "$0.00" at the reference's scale. */
  dollars: string;
  /** "−1.20%", "+0.05%", "0.00%" — two decimals, straight from integer bps. */
  percent: string;
  direction: "up" | "down" | "flat";
}

export function formatDayChange(change: DayChange): DayChangeText {
  const direction = change.deltaRaw > 0n ? "up" : change.deltaRaw < 0n ? "down" : "flat";
  const sign = direction === "up" ? "+" : direction === "down" ? "−" : "";
  const magnitude = change.deltaRaw < 0n ? -change.deltaRaw : change.deltaRaw;
  const absBps = Math.abs(change.bps);
  return {
    dollars: `${sign}${usdLine(magnitude, change.referenceRaw)}`,
    percent: `${sign}${Math.floor(absBps / 100)}.${String(absBps % 100).padStart(2, "0")}%`,
    direction,
  };
}
