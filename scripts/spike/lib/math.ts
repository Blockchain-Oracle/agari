/** The price feed posts 1e18-scaled integers; the oracle's scale is what the spike infers. */
export const FEED_SCALE = 18;

export function pow10(n: number): bigint {
  return 10n ** BigInt(n);
}

/** Rescales an integer between decimal scales, flooring when the scale shrinks. */
export function rescale(value: bigint, fromScale: number, toScale: number): bigint {
  return toScale >= fromScale ? value * pow10(toScale - fromScale) : value / pow10(fromScale - toScale);
}

/** Signed basis-point delta of `actual` versus `reference` (same scale), to two decimals. */
export function deltaBps(actual: bigint, reference: bigint): number | null {
  if (reference === 0n) return null;
  return Number(((actual - reference) * 1_000_000n) / reference) / 100;
}

export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? (sorted[mid] as number) : ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

export function mode<T extends string | number>(values: readonly T[]): T | null {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  let best: T | null = null;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

/** The oracle scale implied by an oracle value and a feed value of the same price: the digit-count gap from 1e18. */
export function inferOracleScale(oracleRaw: bigint, feedRaw18: bigint): number {
  const gap = Math.round(Math.log10(Number(feedRaw18)) - Math.log10(Number(oracleRaw)));
  return FEED_SCALE - gap;
}

export function fmtBps(value: number | null): string {
  if (value === null) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
}

export function fmtScaled(raw: bigint, scale: number, dp = 2): string {
  const whole = raw / pow10(scale);
  const frac = (raw % pow10(scale)).toString().padStart(scale, "0").slice(0, dp);
  return `${whole}.${frac}`;
}

export function pct(part: number, whole: number): string {
  return whole === 0 ? "—" : `${((100 * part) / whole).toFixed(0)}%`;
}
