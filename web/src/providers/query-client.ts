import { QueryClient } from "@tanstack/react-query";

const DEFAULT_STALE_MS = 5_000;

/** One client per app; polling is visibility-gated everywhere (AD-6), so nothing refetches in a background tab. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: DEFAULT_STALE_MS,
        refetchIntervalInBackground: false,
        refetchOnWindowFocus: true,
        retry: 1,
      },
    },
  });
}
