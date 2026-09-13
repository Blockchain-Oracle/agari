"use client";

import type { PrivateStatus } from "@masayume/core/private";
import { useCallback, useEffect, useRef, useState } from "react";

const RETRY_MS = 2_500;

export interface PrivateStatusState {
  /** Null means "still asking" — a false "not available" for the second before the first answer is worse than no control. */
  probing: boolean;
  status: PrivateStatus | null;
  /** The first reason the route is not ready, or the transport's own failure. */
  reason: string | null;
  retry: () => void;
}

/** Probes `/api/private/status` once, retries once on a transport failure, then waits for a manual retry — the reference's `probe` (`Ticket624Drawer.tsx` L147–172). */
export function usePrivateStatus(enabled = true): PrivateStatusState {
  const [probing, setProbing] = useState(enabled);
  const [status, setStatus] = useState<PrivateStatus | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const tries = useRef(0);
  const live = useRef(true);

  const probe = useCallback(() => {
    setProbing(true);
    fetch("/api/private/status", { cache: "no-store" })
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as PrivateStatus | null;
        if (!live.current) return;
        if (!res.ok || !body) throw new Error(`status ${res.status}`);
        setProbing(false);
        setStatus(body);
        setReason(body.ready ? null : (body.reasons[0] ?? "not ready"));
      })
      .catch((error: unknown) => {
        if (!live.current) return;
        if (tries.current++ < 1) {
          window.setTimeout(probe, RETRY_MS);
          return;
        }
        setProbing(false);
        setStatus(null);
        setReason(error instanceof Error ? error.message : "unreachable");
      });
  }, []);

  useEffect(() => {
    live.current = true;
    if (enabled) probe();
    return () => {
      live.current = false;
    };
  }, [enabled, probe]);

  const retry = useCallback(() => {
    tries.current = 0;
    probe();
  }, [probe]);

  // Until the first answer or failure lands, the route is still being asked — never a false "not available" for one frame
  // between the deployment resolving and the probe firing (the reference's `privProbing`, L141–143).
  return { probing: enabled && (probing || (status === null && reason === null)), status, reason, retry };
}
