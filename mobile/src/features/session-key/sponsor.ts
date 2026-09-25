import type { SponsorStatus } from "@agari/markets";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import type { SponsorWire } from "@/features/session/useSponsorStatus";
import { SITE_URL } from "~/lib/env";
import { storage } from "~/lib/storage";

/** web's `/api/sponsor`, absolute: a phone has no page origin to resolve it against. */
export const SPONSOR_ENDPOINT = `${SITE_URL}/api/sponsor`;

const SPONSOR_KEY = ["agari", "session", "sponsor"] as const;
const SPONSOR_STALE_MS = 60_000;
const UNREACHABLE: SponsorStatus = { configured: false, sponsor: null, balanceLamports: null, allowlist: [], reason: "the sponsor could not be reached" };
const DEVICE_KEY = "agari.device";

async function fetchSponsor(): Promise<SponsorStatus> {
  try {
    const response = await fetch(SPONSOR_ENDPOINT, { headers: { "cache-control": "no-store" } });
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

/** web's useSponsorStatus: nothing is asked unless `enabled`; `ensure()` answers from the cache or asks now. */
export function useSponsorStatus(enabled: boolean): { status: SponsorStatus | null; refresh: () => void; ensure: () => Promise<SponsorStatus> } {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: SPONSOR_KEY, queryFn: fetchSponsor, enabled, staleTime: SPONSOR_STALE_MS, retry: false, refetchOnWindowFocus: false });
  const refresh = useCallback(() => void queryClient.invalidateQueries({ queryKey: SPONSOR_KEY }), [queryClient]);
  const ensure = useCallback(() => queryClient.fetchQuery({ queryKey: SPONSOR_KEY, queryFn: fetchSponsor, staleTime: SPONSOR_STALE_MS }), [queryClient]);
  return { status: query.data ?? null, refresh, ensure };
}

/** web's `deviceId()`: a random id per installation for the sponsor's per-device gate. */
export function deviceId(): string {
  const existing = storage.getString(DEVICE_KEY);
  if (existing) return existing;
  const fresh = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  storage.set(DEVICE_KEY, fresh);
  return fresh;
}
