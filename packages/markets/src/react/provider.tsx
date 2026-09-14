"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { MarketsEnv } from "../env";
import { ensureMarkets, exchangeVersion, subscribeExchange } from "../runtime/read-runtime";
import { BootFactsProvider } from "./BootFactsProvider";

/** Configures the shared read runtime once and re-keys the tree whenever it is rebuilt. */
export function MarketsProvider({ env, children }: { env: MarketsEnv; children: ReactNode }) {
  const [version, setVersion] = useState(() => {
    ensureMarkets(env);
    return exchangeVersion();
  });

  useEffect(() => subscribeExchange(() => setVersion(exchangeVersion())), []);

  return (
    <BootFactsProvider key={version} env={env}>
      {children}
    </BootFactsProvider>
  );
}
