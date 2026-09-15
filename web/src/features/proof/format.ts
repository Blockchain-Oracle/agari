import { formatEtClock } from "@agari/core/market";
import { formatBaseUnits } from "@agari/core/units";
import type { PrintProof } from "@agari/markets";

const SUPERSCRIPT: Record<string, string> = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };

/** The integer a source signed and its exponent, as the chain holds them: "35898253 × 10⁻⁵". */
export const integerText = (value: bigint, expo: number): string => `${value} × 10${String(expo).replace(/./g, (c) => SUPERSCRIPT[c] ?? c)}`;

/** "16:00:00 ET" for any instant (boundaries and publish times alike). */
export const etClockSecText = (sec: number): string => `${formatEtClock(sec)}:${String(((sec % 60) + 60) % 60).padStart(2, "0")} ET`;

/**
 * The replayed price against the settled print in the finer scale, the integer rule of `@agari/markets/proof`
 * `printDiff` (server-only there, so the page keeps its own copy): 0n is an exact match.
 */
export function replayDiff(price: bigint, expo: number, printE8: bigint): bigint {
  const shift = 8 + expo;
  return shift >= 0 ? price * 10n ** BigInt(shift) - printE8 : price - printE8 * 10n ** BigInt(-shift);
}

/** Cross-check divergence in integer centi-bps, `|p − c| × 1,000,000 / c` (spec §2 units), shown to 2 dp. */
export function crossCheckBpsText(primaryE8: bigint, checkE8: bigint): string | null {
  if (checkE8 <= 0n) return null;
  const diff = primaryE8 > checkE8 ? primaryE8 - checkE8 : checkE8 - primaryE8;
  return formatBaseUnits((diff * 1_000_000n) / checkE8, 2, { maxDp: 2, minDp: 2 });
}

/** The closing prints of both sources when the Window's policy has a check. */
export function crossCheckPair(prints: readonly PrintProof[]): { primary: PrintProof; check: PrintProof } | null {
  const primary = prints.find((p) => p.which === 1);
  const check = prints.find((p) => p.which === 3);
  return primary && check ? { primary, check } : null;
}
