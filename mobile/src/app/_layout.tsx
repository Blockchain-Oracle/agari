import { MarketsProvider } from "@agari/markets/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { marketsEnv } from "@/lib/env";

export default function RootLayout() {
  // Web's defaults (providers/query-client.ts): 5 s fresh, one retry.
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { staleTime: 5_000, retry: 1 } } }));
  return (
    <QueryClientProvider client={client}>
      <MarketsProvider env={marketsEnv}>
        <Stack screenOptions={{ headerShown: false }} />
      </MarketsProvider>
    </QueryClientProvider>
  );
}
