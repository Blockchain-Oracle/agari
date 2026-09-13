import { formatBaseUnits } from "@masayume/core/units";

/** `+1.20` / `-0.40` / `0.00` — the reference's `signed()` over base units, never a float. */
export function signedMoney(value: bigint, decimals: number, symbol?: string): string {
  const text = value === 0n ? formatBaseUnits(0n, decimals) : formatBaseUnits(value, decimals, { signed: true });
  return symbol ? `${text} ${symbol}` : text;
}

export function signedPct(value: number, digits = 1): string {
  if (Math.abs(value) < 0.05) return (0).toFixed(digits);
  return `${value > 0 ? "+" : "-"}${Math.abs(value).toFixed(digits)}`;
}

export type Tone = "gain" | "loss" | "flat";

export function toneOf(value: bigint): Tone {
  return value > 0n ? "gain" : value < 0n ? "loss" : "flat";
}
