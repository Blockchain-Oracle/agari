"use client";

import type { Reading } from "@agari/core";
import { keys, useMarketsBoot, type MarketsBoot as BootInfo } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { ErrorState, StaleTick } from "@/components/states";
import { webEnv } from "@/lib/env";

const BootContext = createContext<Reading<BootInfo> | null>(null);

/**
 * Boots the chain clock, collateral decimals, and the live venue id. Children always render (server-rendered pages
 * must not be replaced by a skeleton). The boot's own failure or staleness is announced by `BootNotice`, which the
 * shell places inside the page, below the fixed ticker and header, never above them where they would paint over it.
 */
export function MarketsBoot({ children }: { children: ReactNode }) {
  const boot = useMarketsBoot(webEnv.markets);
  return <BootContext.Provider value={boot}>{children}</BootContext.Provider>;
}

/** The boot reading for surfaces that need collateral decimals or the venue id before their first number. */
export function useBoot(): Reading<BootInfo> | null {
  return useContext(BootContext);
}

/**
 * A failed boot, or a stale one's tick, at the top of the page. `not-deployed` is not announced here: no retry can
 * deploy a program, and every surface that needs the chain already renders that honest state itself (D-015).
 */
export function BootNotice() {
  const boot = useBoot();
  const queryClient = useQueryClient();
  if (boot && !boot.ok && boot.error.kind !== "not-deployed") {
    const retry = () => void queryClient.invalidateQueries({ queryKey: keys.boot() });
    return (
      <div className="px-gutter py-2 lg:px-gutter-desktop">
        <ErrorState diagnosis={boot.error} retry={retry} />
      </div>
    );
  }
  if (boot?.ok && boot.stale) {
    return <StaleTick asOfMs={boot.asOfMs} reason={boot.staleReason} className="px-gutter py-1 lg:px-gutter-desktop" />;
  }
  return null;
}
