"use client";

import { SomniaMarketsProvider } from "@somnia-chain/markets-sdk/react";
import { useEffect, useState, type ReactNode } from "react";
import type { MarketsEnv } from "../env";
import { BootFactsProvider } from "./BootFactsProvider";
import { selectReadEndpoint } from "../runtime/health";
import { activeWsIndex, configureMarkets, ensureMarkets, exchangeVersion, getClient, subscribeExchange } from "../runtime/read-runtime";

/** Mounts the SDK's client provider over our singleton; re-keys whenever the singleton is rebuilt (RPC rotation). */
export function MarketsProvider({ env, children }: { env: MarketsEnv; children: ReactNode }) {
  const [version, setVersion] = useState(() => {
    ensureMarkets(env);
    return exchangeVersion();
  });

  useEffect(() => subscribeExchange(() => setVersion(exchangeVersion())), []);

  // The one place a read endpoint is chosen. It runs once, before anything can be signed, so a
  // read failover can never land in the middle of a write; `AUTO_ROTATE_RPC` stays off for the
  // same reason, since rebuilding the singleton drops every live watch with it.
  useEffect(() => {
    let cancelled = false;
    void selectReadEndpoint(env.rpcWsUrls).then((healthy) => {
      if (!cancelled && healthy !== activeWsIndex()) configureMarkets(env, { wsIndex: healthy });
    });
    return () => {
      cancelled = true;
    };
  }, [env]);

  return (
    <SomniaMarketsProvider key={version} client={getClient()}>
      <BootFactsProvider env={env}>{children}</BootFactsProvider>
    </SomniaMarketsProvider>
  );
}
