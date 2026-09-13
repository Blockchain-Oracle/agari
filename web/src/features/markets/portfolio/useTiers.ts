"use client";

import type { Reading } from "@masayume/core/schemas";
import type { Diagnosis, DiagnosisKind } from "@masayume/core/types";
import { mark } from "@masayume/markets/perf";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/** The failures that are about the connection rather than about this wallet's position. */
const CONNECTION_KINDS: ReadonlySet<DiagnosisKind> = new Set<DiagnosisKind>([
  "rpc-down",
  "indexer-down",
  "send-unknown",
  "unknown",
]);

export interface PortfolioTiers {
  /** Every critical read has answered — with a number or with an error. Both are answers. */
  criticalSettled: boolean;
  /** Set only when *every* critical read failed on the connection. */
  outage: Diagnosis | null;
  retry: () => void;
}

/**
 * Splits the Portfolio into the reads it is opened for and the reads that can wait.
 *
 * Two things come out of this. The deferred tier — the multi-page settled-history scan above
 * all — does not start until the critical tier has answered, so the balance and the open bets
 * are not queued behind it. And when every critical read has failed for the same reason, that
 * reason is one fact about the connection, not five independent panel failures: reporting it
 * once with one retry is the difference between an outage and a page of competing buttons.
 *
 * A partial failure is deliberately *not* an outage. If the balance loaded and only claims
 * failed, the page is still useful and that section owns its own error.
 */
export function usePortfolioTiers(critical: readonly (Reading<unknown> | null)[]): PortfolioTiers {
  const queryClient = useQueryClient();
  const retry = useCallback(() => void queryClient.invalidateQueries(), [queryClient]);

  const criticalSettled = critical.length > 0 && critical.every((reading) => reading !== null);
  const failures = critical.filter((reading) => reading !== null && !reading.ok);
  const allFailed = criticalSettled && failures.length === critical.length;
  const first = failures[0];
  const outage = allFailed && first && !first.ok && CONNECTION_KINDS.has(first.error.kind) ? first.error : null;

  if (criticalSettled && !outage) mark("critical.ready", "portfolio");

  return { criticalSettled, outage, retry };
}
