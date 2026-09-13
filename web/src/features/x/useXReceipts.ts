"use client";

import { useQuery } from "@tanstack/react-query";
import type { XReceiptsFeed } from "./protocol";

const POLL_MS = 15_000;

/** The mentions the relay executed for this wallet; `null` until the first answer. */
export function useXReceipts(wallet: string | null): XReceiptsFeed | null {
  const query = useQuery({
    queryKey: ["masayume", "x-receipts", wallet],
    queryFn: async () => {
      const response = await fetch(`/api/x/receipts?wallet=${encodeURIComponent(wallet as string)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`receipts ${response.status}`);
      return (await response.json()) as XReceiptsFeed;
    },
    enabled: wallet !== null,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });
  return query.data ?? null;
}
