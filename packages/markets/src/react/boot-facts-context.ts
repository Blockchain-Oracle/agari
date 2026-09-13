"use client";

import { createContext, useContext } from "react";
import type { BootFact } from "./boot-fact";

export type BootFactReadiness = Record<BootFact, boolean>;

const NONE: BootFactReadiness = { clock: false, collateral: false, venue: false };

/**
 * Which boot facts are known.
 *
 * Deliberately a context rather than an observation of the query cache. Reading readiness by
 * mounting a second `useQuery` on the same key with `skipToken` puts two observers with
 * different options on one query, and a refetch then resolves against whichever synced last —
 * which produced a real "Missing queryFn" failure the moment a fact errored and something
 * triggered a refetch. One writer, many readers, no collision.
 */
export const BootFactsContext = createContext<BootFactReadiness>(NONE);

export function useBootFacts(): BootFactReadiness {
  return useContext(BootFactsContext);
}
