"use client";

import { isOk } from "@masayume/core/schemas";
import { getStrategy } from "@masayume/markets/strategies";
import { useCallback, useEffect, useState } from "react";

/** The fee is charged by every subscribe call, including a resume or replacement grant. */
export function useSubscriptionFee(strategyId: string, afterWrite: string | null) {
  const [fee, setFee] = useState<bigint | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let live = true;
    setFee(null);
    setError(null);
    void getStrategy(BigInt(strategyId)).then((reading) => {
      if (!live) return;
      if (isOk(reading) && !reading.stale && reading.value?.active) setFee(reading.value.feeBase);
      else setError("The current subscription fee could not be verified. Retry before signing.");
    }).catch(() => { if (live) setError("The current subscription fee could not be verified. Retry before signing."); });
    return () => { live = false; };
  }, [strategyId, afterWrite, revision]);
  return { fee, error, refresh: useCallback(() => setRevision((v) => v + 1), []) };
}
