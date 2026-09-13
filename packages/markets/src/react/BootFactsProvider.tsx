"use client";

import { useMemo, type ReactNode } from "react";
import type { MarketsEnv } from "../env";
import { BootFactsContext, type BootFactReadiness } from "./boot-facts-context";
import { useClockFact, useCollateralFact, useVenueFact } from "./useMarketsBoot";

/**
 * The single owner of the three boot-fact queries.
 *
 * Every other read only ever *reads* their readiness from context, so there is exactly one
 * observer per fact with exactly one set of options. Mounted inside `MarketsProvider`, above
 * anything that could declare a `needs`.
 */
export function BootFactsProvider({ env, children }: { env: MarketsEnv; children: ReactNode }) {
  const clock = useClockFact();
  const collateral = useCollateralFact();
  const venue = useVenueFact(env);

  const clockOk = clock?.ok === true;
  const collateralOk = collateral?.ok === true;
  const venueOk = venue?.ok === true;
  const value = useMemo<BootFactReadiness>(
    () => ({ clock: clockOk, collateral: collateralOk, venue: venueOk }),
    [clockOk, collateralOk, venueOk],
  );

  return <BootFactsContext.Provider value={value}>{children}</BootFactsContext.Provider>;
}
