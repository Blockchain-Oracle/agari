import { PRINT_DECIMALS } from "@agari/core/range";
import { formatOracleRaw } from "@agari/core/units";

/** One dollar on the print scale. The reference worked in cents; a print here carries 10⁻⁸ (`PRINT_DECIMALS`). */
const ONE_USD = 10n ** BigInt(PRINT_DECIMALS);
/** Under this print a band's edges need cents to be told apart (ETH at $2.4k sits on a $0.20 grid). */
const CENTS_MATTER_BELOW = 10_000n * ONE_USD;

/** Whole dollars, grouped, from a print in cents — the reference's `fmtUsd0`. */
export function usd0(print: bigint): string {
  return `$${formatOracleRaw(print, PRINT_DECIMALS, 0)}`;
}

/** Dollars and cents from a print. */
export function usd2(print: bigint): string {
  return `$${formatOracleRaw(print, PRINT_DECIMALS, 2)}`;
}

/** A band edge: the reference's whole dollars where the asset trades in the tens of thousands, cents below that. */
export function usdBand(print: bigint): string {
  return print < CENTS_MATTER_BELOW ? usd2(print) : usd0(print);
}

/** A dollar amount on the band's grid — `$5`, `$0.20`, `$1,240`. */
export function usdOnGrid(usd: number, decimals: number): string {
  return `$${usd.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

/** A print → dollars with cents, for the band arithmetic the reference does in dollars. */
export function printToUsd(print: bigint): number {
  return Number(print) / Number(ONE_USD);
}

export function usdToPrint(usd: number): bigint {
  return BigInt(Math.round(usd * Number(ONE_USD)));
}

/** `multiplier.toFixed(1)` without a float — the reference's slip figure. */
export function formatMultiplierTenths(milli: number): string {
  const tenths = Math.round(milli / 100);
  return `${Math.floor(tenths / 10)}.${tenths % 10}×`;
}

/** A probability per 1e6 as `31.6`. */
export function formatProbE6(probE6: bigint): string {
  const tenths = Number(probE6 / 1_000n);
  return `${Math.floor(tenths / 10)}.${tenths % 10}`;
}

export function utilizationPct(bps: number): string {
  return String(Math.round(bps / 100));
}
