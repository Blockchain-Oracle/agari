import { formatBaseUnits } from "@masayume/core/units";

/** Basis points as cents, one decimal only when the tick needs it: 400 → "4¢", 50 → "0.5¢". */
export function centsText(bps: number): string {
  const cents = bps / 100;
  return Number.isInteger(cents) ? `${cents}¢` : `${cents.toFixed(1)}¢`;
}

/** `part` as a percentage of `whole`, one decimal — the spread against the mid. */
export function pctOfText(partBps: number, wholeBps: number): string {
  if (wholeBps === 0) return "0.0";
  return ((partBps * 100) / wholeBps).toFixed(1);
}

/** Contracts read like the ticket's: no forced decimals, two at most. */
export function contractsText(raw: bigint, decimals: number): string {
  return formatBaseUnits(raw, decimals, { minDp: 0, maxDp: 2 });
}

/** The venue's lot is a fraction of a contract; print it to the base unit rather than rounding it to nothing. */
export function lotText(raw: bigint, decimals: number): string {
  return formatBaseUnits(raw, decimals, { minDp: 0, maxDp: decimals, group: false });
}
