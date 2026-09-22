/**
 * The desk's integer units (desk.md §1, §8). A PreStocks name is a Token-2022 mint with 9 dp and a ScaledUiAmount
 * multiplier: one UI token = `raw × multiplier / 10^9`, and the catalogue prices a UI token (`tokenPrice`, `markPrice`).
 * The chain, Jupiter and the desk's own ATAs all speak raw. So every conversion is:
 *
 *   value_E6 = raw × multiplier_E12 × price_E8 / 10^23        (10^23 = 9 + 12 + 8 − 6)
 *   raw      = usdc_E6 × 10^23 / (multiplier_E12 × price_E8)
 *
 * The program repeats these with u128 (`guard.rs`), and the mint's own f64 is never read on the money path: the
 * attestor signs `multiplier_e12`, floored to 12 places from the RPC's decimal text (`scaled-amount.ts`).
 */
import { sharesE8 } from "./scaled-amount";

export const USDC_DECIMALS = 6;
export const TOKEN_DECIMALS = 9;
export const PRICE_DECIMALS = 8;
export const MULTIPLIER_DECIMALS = 12;
/** `10^(9 + 12 + 8 − 6)`. */
export const VALUE_SCALE = 10n ** 23n;
export const BPS = 10_000n;
export const BPS_NUMBER = 10_000;

/** What `raw` of a name is worth in USDC base units at `priceE8` per UI token. */
export function valueE6(raw: bigint, multiplierE12: bigint, priceE8: bigint): bigint {
  if (raw <= 0n || multiplierE12 <= 0n || priceE8 <= 0n) return 0n;
  return (raw * multiplierE12 * priceE8) / VALUE_SCALE;
}

/** The raw amount `usdcE6` buys at `priceE8` per UI token, floored; 0 when the price or multiplier is not positive. */
export function rawFor(usdcE6: bigint, multiplierE12: bigint, priceE8: bigint): bigint {
  if (usdcE6 <= 0n || multiplierE12 <= 0n || priceE8 <= 0n) return 0n;
  return (usdcE6 * VALUE_SCALE) / (multiplierE12 * priceE8);
}

/** UI tokens × 10^8 for a raw balance (the holdings reader's `sharesE8` at 9 dp). */
export function uiTokensE8(raw: bigint, multiplierE12: bigint): bigint {
  return sharesE8(raw, TOKEN_DECIMALS, multiplierE12);
}

/** `part / whole` in basis points, as a safe integer; 0 when `whole` is 0. */
export function bpsOf(part: bigint, whole: bigint): number {
  return whole === 0n ? 0 : Number((part * BPS) / whole);
}

/** `(a − b) / b` in basis points (negative when `a` is below `b`); 0 when `b` is 0. */
export function bpsBetween(a: bigint, b: bigint): number {
  return b === 0n ? 0 : Number(((a - b) * BPS) / b);
}

export const minBigint = (a: bigint, b: bigint): bigint => (a < b ? a : b);
export const maxBigint = (a: bigint, b: bigint): bigint => (a > b ? a : b);
export const absBigint = (a: bigint): bigint => (a < 0n ? -a : a);

/**
 * A plain decimal string (`"1234.5"`, `"0.000001"`, `"7"`) for a record or the wire: no grouping, no trailing
 * zeros, no exponent, never a float. Negative values keep their sign (grades, timing sums).
 */
export function decimalString(value: bigint, decimals: number): string {
  const negative = value < 0n;
  const magnitude = negative ? -value : value;
  const one = 10n ** BigInt(decimals);
  const whole = (magnitude / one).toString();
  const fraction = (magnitude % one).toString().padStart(decimals, "0").replace(/0+$/, "");
  const body = fraction.length > 0 ? `${whole}.${fraction}` : whole;
  return negative ? `-${body}` : body;
}

/** The inverse of `decimalString` for non-negative plain decimals; null for anything else (a sign, an exponent, words). */
export function parseDecimal(text: string, decimals: number): bigint | null {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!match) return null;
  const fraction = (match[2] ?? "").slice(0, decimals).padEnd(decimals, "0");
  return BigInt(match[1] as string) * 10n ** BigInt(decimals) + BigInt(fraction || "0");
}

export const formatUsdc = (e6: bigint): string => decimalString(e6, USDC_DECIMALS);
export const formatTokens = (raw: bigint): string => decimalString(raw, TOKEN_DECIMALS);
export const formatPriceE8 = (e8: bigint): string => decimalString(e8, PRICE_DECIMALS);
export const formatMultiplierE12 = (e12: bigint): string => decimalString(e12, MULTIPLIER_DECIMALS);

/** `"12.3%"` from basis points, one decimal, for sentences. */
export const pct = (bps: number): string => `${(bps / 100).toFixed(1)}%`;
