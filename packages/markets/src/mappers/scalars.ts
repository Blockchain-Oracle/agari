import type { Address } from "@masayume/core/types";
import { secToMs } from "@masayume/core/units";

export type Scalar = string | number | bigint | null | undefined;

/** Indexer numerics arrive as decimal strings; a malformed one becomes null instead of crashing BigInt() (NFR-4). */
export function bigintOf(value: Scalar): bigint | null {
  if (value === null || value === undefined || value === "") return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export function bigintOrZero(value: Scalar): bigint {
  return bigintOf(value) ?? 0n;
}

export function numberOf(value: Scalar): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function secToMsOrNull(value: Scalar): number | null {
  const sec = numberOf(value);
  return sec === null ? null : secToMs(sec);
}

export function lowerAddress(value: string): Address {
  return value.toLowerCase() as Address;
}
