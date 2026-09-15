"use client";

import type { Address } from "@agari/core/types";
import type { SponsorStatus } from "@agari/markets";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

export const SPONSOR_ENDPOINT = "/api/sponsor";

/** `GET /api/sponsor` on the wire (tap-trading.md §3): lamports as a decimal string. The route answers with exactly this shape. */
export interface SponsorWire {
  configured: boolean;
  sponsor: Address | null;
  balanceLamports: string | null;
  allowlist: SponsorStatus["allowlist"];
  reason?: string;
}

const SPONSOR_KEY = ["agari", "session", "sponsor"] as const;
/** The breaker and the balance move slowly; an open sheet re-asks at most this often. */
const SPONSOR_STALE_MS = 60_000;
const UNREACHABLE: SponsorStatus = { configured: false, sponsor: null, balanceLamports: null, allowlist: [], reason: "the sponsor could not be reached" };

async function fetchSponsor(): Promise<SponsorStatus> {
  try {
    const response = await fetch(SPONSOR_ENDPOINT, { cache: "no-store" });
    const wire = (await response.json()) as SponsorWire;
    return {
      configured: wire.configured === true,
      sponsor: wire.sponsor ?? null,
      allowlist: wire.allowlist ?? [],
      balanceLamports: wire.balanceLamports == null ? null : BigInt(wire.balanceLamports),
      ...(wire.reason ? { reason: wire.reason } : {}),
    };
  } catch {
    return UNREACHABLE;
  }
}

/**
 * Asks the fee-payer co-signer whether it exists and what it will pay for; null until it has answered. Audit P-11:
 * nothing is fetched unless `enabled` (the enable or manage sheet is open, or a key is armed), so no page load asks.
 * `ensure()` answers from the cache or asks now, for a flow that must know before it signs.
 */
export function useSponsorStatus(enabled: boolean): { status: SponsorStatus | null; refresh: () => void; ensure: () => Promise<SponsorStatus> } {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: SPONSOR_KEY, queryFn: fetchSponsor, enabled, staleTime: SPONSOR_STALE_MS, retry: false, refetchOnWindowFocus: false });
  const refresh = useCallback(() => void queryClient.invalidateQueries({ queryKey: SPONSOR_KEY }), [queryClient]);
  const ensure = useCallback(() => queryClient.fetchQuery({ queryKey: SPONSOR_KEY, queryFn: fetchSponsor, staleTime: SPONSOR_STALE_MS }), [queryClient]);
  return { status: query.data ?? null, refresh, ensure };
}
