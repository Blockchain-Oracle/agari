/**
 * Moved to core at S21 (`packages/core/src/desk/scaled-amount.ts`): the desk values holdings with the same integer
 * ScaledUiAmount maths the holdings reader uses, and core stays pure. This re-export keeps every `holdings/*` import.
 */
export { decimalToE12, effectiveMultiplierE12, exposureUsdE6, MULTIPLIER_DP, MULTIPLIER_SCALE, sharesE8, type ScaledUiAmountState } from "@agari/core/desk";
