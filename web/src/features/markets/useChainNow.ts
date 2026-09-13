"use client";

import { marketsProvider } from "@masayume/markets";
import { useEffect, useState } from "react";
import { useDocumentVisible } from "@/lib/visibility";

const TICK_MS = 1_000;

/** Chain-offset-corrected clock that ticks while the tab is visible; 0 until the first client tick so server and client markup agree. */
export function useChainNowMs(): number {
  const visible = useDocumentVisible();
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    if (!visible) return;
    setNowMs(marketsProvider.nowMs());
    const id = setInterval(() => setNowMs(marketsProvider.nowMs()), TICK_MS);
    return () => clearInterval(id);
  }, [visible]);

  return nowMs;
}
