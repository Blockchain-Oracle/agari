import { err, type Reading } from "@masayume/core/schemas";
import type { DiagnosisKind } from "@masayume/core/types";
import { useQuery, type QueryKey } from "@tanstack/react-query";
import { diagnose } from "../errors/error-map";
import { ReadingError } from "../errors/reading-error";
import { BOOT_FACTS, type BootFact } from "./boot-fact";
import { useBootFacts } from "./boot-facts-context";

const DEFAULT_STALE_MS = 5_000;
const MAX_READ_RETRIES = 2;

/**
 * Infrastructure, not domain.
 *
 * A read that fails this way failed to reach the chain or the indexer, so trying again is
 * meaningful. Everything else — a revert, an undeployed contract, an already-claimed
 * position, a wrong chain — will fail identically forever, and retrying it only delays the
 * honest error the user needs to see.
 */
const RETRYABLE_READ_KINDS: ReadonlySet<DiagnosisKind> = new Set<DiagnosisKind>([
  "indexer-down",
  "rpc-down",
  "send-unknown",
  "unknown",
]);

function isInfrastructureFailure(error: unknown): boolean {
  return RETRYABLE_READ_KINDS.has(diagnose(error).kind);
}

export type PollInterval<T> = number | ((reading: Reading<T> | null) => number | false);

export interface ReadingQueryOptions<T> {
  pollMs?: PollInterval<T>;
  enabled?: boolean;
  staleTimeMs?: number;
  /**
   * The boot facts this read genuinely cannot be correct without.
   *
   * Defaults to all three, because a wallet-scoped read that fires before collateral decimals
   * are known fails with "collateral not loaded" and stays failed until its next poll. A read
   * that needs less should say so: a public lane list needs the venue id, not the chain clock,
   * and making it wait for all three is what put twenty seconds between the shell and the
   * first market card.
   */
  needs?: readonly BootFact[];
}

/**
 * TanStack Query over a port read.
 *
 * Two contracts hold here. First, a read waits only for the boot facts it declares, so one
 * slow venue resolution no longer gates the whole application. Second, a first-ever
 * infrastructure failure *rejects*: only a rejected promise gives TanStack a real error
 * state and its retry policy. Domain failures still resolve as the error arm of a `Reading`,
 * because a revert is an answer, not an outage, and retrying it is noise.
 *
 * A failed *refresh* is not a rejection: `withReading` has already substituted the last-good
 * value and flipped `stale`, which is the behaviour worth keeping — a user watching a live
 * number would rather see the last true one labelled stale than an empty panel. Those retry
 * on the next poll rather than immediately.
 *
 * Returns null only before any result exists.
 */
export function useReadingQuery<T>(
  queryKey: QueryKey,
  read: () => Promise<Reading<T>>,
  options: ReadingQueryOptions<T> = {},
): Reading<T> | null {
  const { pollMs, enabled = true, staleTimeMs, needs = BOOT_FACTS } = options;
  const facts = useBootFacts();
  const needsMet = needs.every((fact) => facts[fact]);
  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const reading = await read().catch((error) => err(diagnose(error)));
      if (!reading.ok && isInfrastructureFailure(reading.error)) throw new ReadingError(reading.error);
      return reading;
    },
    enabled: enabled && needsMet,
    retry: (failureCount, error) => failureCount < MAX_READ_RETRIES && isInfrastructureFailure(error),
    refetchInterval: typeof pollMs === "function" ? (q) => pollMs(q.state.data ?? null) : (pollMs ?? false),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    staleTime: staleTimeMs ?? (typeof pollMs === "number" ? pollMs : DEFAULT_STALE_MS),
  });

  const data = query.data ?? null;
  if (data) return data;
  if (query.isError) return err(diagnose(query.error));
  return null;
}

export { BOOT_FACTS, isInfrastructureFailure, type BootFact };
