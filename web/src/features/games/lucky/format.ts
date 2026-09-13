import { impliedMultipleHundredths } from "@masayume/core/games";

/** `294` hundredths → `2.94×`; a whole multiple drops its zeros (`300` → `3×`). Integer in, string out — no float. */
export function formatMultiple(hundredths: number): string {
  const whole = Math.floor(hundredths / 100);
  const rest = hundredths % 100;
  if (rest === 0) return `${whole}×`;
  const cents = String(rest).padStart(2, "0").replace(/0$/, "");
  return `${whole}.${cents}×`;
}

/** The gross multiple a price pays, as a word for a screen. */
export function multipleAt(avgPriceBps: number): string {
  return formatMultiple(impliedMultipleHundredths(avgPriceBps));
}
