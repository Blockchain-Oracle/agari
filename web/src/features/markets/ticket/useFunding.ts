"use client";

import type { Address, OnchainSnapshot, Quote } from "@masayume/core/types";
import { assertFunded, type FundingCheck } from "@masayume/markets";
import { useEffect, useState } from "react";

/**
 * Pre-checks collateral, venue credit, allowance and gas for the quoted escrow so the approval sentence
 * and any shortfall show BEFORE the wallet opens; the order lane re-runs the same check at send.
 */
export function useFundingCheck(wallet: Address | null, onchain: OnchainSnapshot | null, quote: Quote | null): FundingCheck | null {
  const [check, setCheck] = useState<FundingCheck | null>(null);
  const escrowKey = quote ? `${quote.side}:${quote.maxCostBase}` : null;
  const marketId = onchain?.marketId ?? null;

  useEffect(() => {
    if (!wallet || !onchain || !quote) {
      setCheck(null);
      return;
    }
    let cancelled = false;
    void assertFunded(wallet, onchain, quote).then((result) => {
      if (!cancelled) setCheck(result);
    });
    return () => {
      cancelled = true;
    };
    // Re-runs when the escrow changes, not on every requote of the same size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallet, marketId, escrowKey]);

  return check;
}
