"use client";

import type { Address } from "@masayume/core/types";
import type { SponsorStatus } from "@masayume/markets";
import { useCallback, useEffect, useState } from "react";

export const SPONSOR_ENDPOINT = "/api/sponsor";

interface SponsorWire {
  configured: boolean;
  sponsor: Address | null;
  balanceWei: string | null;
  forwarder: Address | null;
  allowlist: SponsorStatus["allowlist"];
}

/** Asks the relayer once whether it exists and what it will pay for; null until it has answered. */
export function useSponsorStatus(): { status: SponsorStatus | null; refresh: () => void } {
  const [status, setStatus] = useState<SponsorStatus | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetch(SPONSOR_ENDPOINT)
      .then((r) => r.json() as Promise<SponsorWire>)
      .then((wire) => {
        if (cancelled) return;
        setStatus({ ...wire, balanceWei: wire.balanceWei === null ? null : BigInt(wire.balanceWei) });
      })
      .catch(() => {
        if (!cancelled) setStatus({ configured: false, sponsor: null, balanceWei: null, forwarder: null, allowlist: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);
  return { status, refresh: useCallback(() => setNonce((n) => n + 1), []) };
}
