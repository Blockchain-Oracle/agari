/**
 * Opening prints already seen, by Window. A recorded print never changes (FR-7), so one seen anywhere (the chain slice,
 * or an index row the lanes list carried) is kept for the tab's life and never read again.
 */
const openingPrints = new Map<string, bigint>();

export function rememberOpeningPrint(marketId: string, priceRaw: bigint): void {
  openingPrints.set(marketId, priceRaw);
}

export function seenOpeningPrint(marketId: string): bigint | undefined {
  return openingPrints.get(marketId);
}
