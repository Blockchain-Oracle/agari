"use client";

import { useMemo, type ReactNode } from "react";
import type { MarketsEnv } from "../env";
import { BootFactsContext, type BootFactState } from "./boot-facts-context";
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
  const clockError = clock && !clock.ok ? clock.error : undefined;
  const collateralError = collateral && !collateral.ok ? collateral.error : undefined;
  const venueError = venue && !venue.ok ? venue.error : undefined;
  const value = useMemo<BootFactState>(
    () => ({
      ready: { clock: clockOk, collateral: collateralOk, venue: venueOk },
      failed: {
        ...(clockError ? { clock: clockError } : {}),
        ...(collateralError ? { collateral: collateralError } : {}),
        ...(venueError ? { venue: venueError } : {}),
      },
    }),
    [clockOk, collateralOk, venueOk, clockError, collateralError, venueError],
  );

  return <BootFactsContext.Provider value={value}>{children}</BootFactsContext.Provider>;
}
