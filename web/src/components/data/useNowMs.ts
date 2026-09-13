"use client";

import { useEffect, useState } from "react";
import { useDocumentVisible } from "@/lib/visibility";

const DEFAULT_TICK_MS = 1000;

/** Ticks once a second while the tab is visible; returns 0 until the first client tick so server and client markup agree. */
export function useNowMs(externalNowMs?: number, tickMs = DEFAULT_TICK_MS): number {
  const visible = useDocumentVisible();
  const [nowMs, setNowMs] = useState(externalNowMs ?? 0);

  useEffect(() => {
    if (externalNowMs !== undefined) {
      setNowMs(externalNowMs);
      return;
    }
    if (!visible) return;
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [externalNowMs, tickMs, visible]);

  return nowMs;
}
