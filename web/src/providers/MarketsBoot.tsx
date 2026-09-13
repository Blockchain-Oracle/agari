"use client";

import type { Reading } from "@masayume/core";
import { keys, useMarketsBoot, type MarketsBoot as BootInfo } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, type ReactNode } from "react";
import { ErrorState, StaleTick } from "@/components/states";
import { webEnv } from "@/lib/env";

const BootContext = createContext<Reading<BootInfo> | null>(null);

/**
 * Boots the chain clock, collateral decimals, and the live venue id. Children always render (server-rendered pages
 * must not be replaced by a skeleton); a failed boot is announced above the app and a stale one carries its tick.
 */
export function MarketsBoot({ children }: { children: ReactNode }) {
  const boot = useMarketsBoot(webEnv.markets);
  const queryClient = useQueryClient();
  const retry = () => void queryClient.invalidateQueries({ queryKey: keys.boot() });

  return (
    <BootContext.Provider value={boot}>
      {boot && !boot.ok && (
        <div className="px-gutter py-2 lg:px-gutter-desktop">
          <ErrorState diagnosis={boot.error} retry={retry} />
        </div>
      )}
      {boot?.ok && boot.stale && (
        <StaleTick asOfMs={boot.asOfMs} reason={boot.staleReason} className="px-gutter py-1 lg:px-gutter-desktop" />
      )}
      {children}
    </BootContext.Provider>
  );
}

/** The boot reading for surfaces that need collateral decimals or the venue id before their first number. */
export function useBoot(): Reading<BootInfo> | null {
  return useContext(BootContext);
}
