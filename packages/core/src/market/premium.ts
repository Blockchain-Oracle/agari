/**
 * How far a token trades from a reference that prices the same company: PreStocks' own mark (the SPV's valuation per
 * token) today, Pyth's `Equity.Index` valuation feed where the venue is entitled to it (S20), or the mark the desk's
 * premium ceiling reads (S21). Integer basis points, bigint throughout, so a 15-significant-digit price never rounds
 * through a float; positive when the token is above the reference. Null when the reference is not positive.
 */
export function referencePremiumBps(tokenPriceE8: bigint, referenceE8: bigint): number | null {
  if (referenceE8 <= 0n) return null;
  return Number(((tokenPriceE8 - referenceE8) * 10_000n) / referenceE8);
}
