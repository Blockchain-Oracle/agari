"use client";

import { MarketsProvider } from "@agari/markets/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AlertsWatcher } from "@/features/alerts";
import { PerfProbe } from "@/features/perf";
import { WriteRecovery } from "@/features/recovery";
import { SessionKeyProvider, SessionRecovery } from "@/features/session";
import { webEnv } from "@/lib/env";
import { MarketsBoot } from "./MarketsBoot";
import { usePersistedReadCache } from "./persist";
import { createQueryClient } from "./query-client";
import { UserSessionProvider } from "./UserSessionProvider";
import { WalletShellProvider } from "./wallet/WalletShellProvider";

/** Client composition root: wallet shell (Wallet Standard via the Kit wallet plugin) → query cache → shared read runtime → isolated signing session → boot gate → session key. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  usePersistedReadCache(queryClient);
  return (
    <WalletShellProvider>
      <QueryClientProvider client={queryClient}>
        {/* Measures the read path and publishes it for a measurement run; it changes nothing. */}
        <PerfProbe />
        <MarketsProvider env={webEnv.markets}>
          <UserSessionProvider>
            <MarketsBoot>
              {/* The browser-held session key: alive only while the owner's SESSION grant is, and this browser holds the key. */}
              <SessionKeyProvider>
                {/* The price-alert evaluator: one watch per asset with a pending rule, on the shared read runtime. */}
                <AlertsWatcher />
                {/* Writes the journal still holds open are asked about once per session; nothing is re-sent. */}
                <WriteRecovery />
                <SessionRecovery />
                {children}
              </SessionKeyProvider>
            </MarketsBoot>
          </UserSessionProvider>
        </MarketsProvider>
      </QueryClientProvider>
    </WalletShellProvider>
  );
}
