"use client";

import type { Address } from "@agari/core/types";
import type { SponsorStatus } from "@agari/markets";
import { useCallback, useEffect, useState } from "react";

export const SPONSOR_ENDPOINT = "/api/sponsor";

/** `GET /api/sponsor` on the wire: lamports as a decimal string. The route answers with exactly this shape. */
export interface SponsorWire {
  configured: boolean;
  sponsor: Address | null;
  balanceLamports: string | null;
  allowlist: SponsorStatus["allowlist"];
}

/** Asks the fee-payer co-signer once whether it exists and what it will pay for; null until it has answered. */
export function useSponsorStatus(): { status: SponsorStatus | null; refresh: () => void } {
  const [status, setStatus] = useState<SponsorStatus | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch(SPONSOR_ENDPOINT)
      .then((r) => r.json() as Promise<SponsorWire>)
      .then((wire) => {
        if (cancelled) return;
        setStatus({ configured: wire.configured, sponsor: wire.sponsor, allowlist: wire.allowlist ?? [], balanceLamports: wire.balanceLamports === null ? null : BigInt(wire.balanceLamports) });
      })
      .catch(() => {
        if (!cancelled) setStatus({ configured: false, sponsor: null, balanceLamports: null, allowlist: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);
  return { status, refresh: useCallback(() => setNonce((n) => n + 1), []) };
}
