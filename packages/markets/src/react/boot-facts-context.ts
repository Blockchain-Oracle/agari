"use client";

import type { Diagnosis } from "@agari/core/types";
import { createContext, useContext } from "react";
import type { BootFact } from "./boot-fact";

export type BootFactReadiness = Record<BootFact, boolean>;

/** Why a boot fact failed, when it did. A read that needs a failed fact resolves to this error instead of waiting forever. */
export type BootFactFailures = Partial<Record<BootFact, Diagnosis>>;

export interface BootFactState {
  ready: BootFactReadiness;
  failed: BootFactFailures;
}

const NONE: BootFactState = { ready: { clock: false, collateral: false, venue: false }, failed: {} };

/**
 * Which boot facts are known.
 *
 * Deliberately a context rather than an observation of the query cache. Reading readiness by
 * mounting a second `useQuery` on the same key with `skipToken` puts two observers with
 * different options on one query, and a refetch then resolves against whichever synced last —
 * which produced a real "Missing queryFn" failure the moment a fact errored and something
 * triggered a refetch. One writer, many readers, no collision.
 */
export const BootFactsContext = createContext<BootFactState>(NONE);

export function useBootFacts(): BootFactReadiness {
  return useContext(BootFactsContext).ready;
}

export function useBootFactState(): BootFactState {
  return useContext(BootFactsContext);
}
