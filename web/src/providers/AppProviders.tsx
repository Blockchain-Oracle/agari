"use client";

import "@rainbow-me/rainbowkit/styles.css";
import { SOMNIA_SHANNON } from "@masayume/markets/chain";
import { MarketsProvider } from "@masayume/markets/react";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { AlertsWatcher } from "@/features/alerts";
import { PerfProbe } from "@/features/perf";
import { WriteRecovery } from "@/features/recovery";
import { SessionKeyProvider, SessionRecovery } from "@/features/session";
import { BRAND } from "@/lib/copy";
import { webEnv } from "@/lib/env";
import { MarketsBoot } from "./MarketsBoot";
import { usePersistedReadCache } from "./persist";
import { createQueryClient } from "./query-client";
import { rainbowKitTheme } from "./rainbowkit-theme";
import { UserSessionProvider } from "./UserSessionProvider";
import { wagmiConfig } from "./wagmi";

/** Client composition root: wallet session → query cache → wallet UI → shared read runtime → isolated signing session → boot gate → session key. */
export function AppProviders({ children }: { children: ReactNode }) {
  const [queryClient] = useState(createQueryClient);
  usePersistedReadCache(queryClient);
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {/* Measures the read path and publishes it for a measurement run; it changes nothing. */}
        <PerfProbe />
        <RainbowKitProvider theme={rainbowKitTheme} initialChain={SOMNIA_SHANNON} modalSize="compact" appInfo={{ appName: BRAND.name }}>
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
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
