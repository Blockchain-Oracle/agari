/**
 * Token-2022 `ScaledUiAmount` in integers (session-lanes.md §4, D-058). A share token's raw balance never changes; the
 * issuer moves a multiplier for dividends and splits, so the UI amount (one UI token ≈ one share of the underlying) is
 * `raw × multiplier / 10^decimals`. The chain stores the multiplier as an f64 and the RPC prints it as a decimal string
 * with up to 16 places, so it is floored to 12 places here (< 10⁻¹² relative) and never parsed to a float.
 */

export const MULTIPLIER_DP = 12;
export const MULTIPLIER_SCALE = 10n ** BigInt(MULTIPLIER_DP);
/** Shares and prices are both × 10⁸ (`PRINT_EXPO`); exposure is USD × 10⁶ (tUSDC base units at 6 dp). */
const E8 = 10n ** 8n;
const E8_TIMES_E8_OVER_E6 = 10n ** 10n;

/** The mint extension as jsonParsed prints it: two decimal strings and the switch-over second. */
export interface ScaledUiAmountState {
  multiplier: string;
  newMultiplier: string;
  newMultiplierEffectiveTimestamp: number;
}

const DECIMAL_TEXT = /^(\d+)(?:\.(\d+))?$/;

/** `"1.0017152487959897"` → `1_001_715_248_795n`. Null for anything that is not a plain non-negative decimal. */
export function decimalToE12(text: string): bigint | null {
  const match = DECIMAL_TEXT.exec(text.trim());
  if (!match) return null;
  const fraction = (match[2] ?? "").slice(0, MULTIPLIER_DP).padEnd(MULTIPLIER_DP, "0");
  return BigInt(match[1] as string) * MULTIPLIER_SCALE + BigInt(fraction);
}

/** Token-2022's own rule: the scheduled multiplier applies from its timestamp on, even before `multiplier` is rewritten. */
export function effectiveMultiplierE12(state: ScaledUiAmountState | null, nowSec: number): bigint | null {
  if (state === null) return MULTIPLIER_SCALE;
  return decimalToE12(nowSec >= state.newMultiplierEffectiveTimestamp ? state.newMultiplier : state.multiplier);
}

/** `raw × multiplierE12 × 10⁸ / (10^decimals × 10¹²)`, floored once at the end. */
export function sharesE8(rawAmount: bigint, decimals: number, multiplierE12: bigint): bigint {
  return (rawAmount * multiplierE12 * E8) / (10n ** BigInt(decimals) * MULTIPLIER_SCALE);
}

/** `sharesE8 × priceE8 / 10¹⁰`: USD × 10⁶ of the underlying the balance tracks. */
export function exposureUsdE6(shares: bigint, priceE8: bigint): bigint {
  return (shares * priceE8) / E8_TIMES_E8_OVER_E6;
}
