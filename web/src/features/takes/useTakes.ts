"use client";

import type { MarketId, Side } from "@masayume/core/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useSignMessage } from "wagmi";
import { useWalletSession } from "@/lib/wallet-session";
import { TAKE_ERRORS } from "./copy";
import { TAKES_FEED_LIMIT, takeMessage, type FeedTake, type TakesFeed } from "./protocol";

/** The reference polls its takes every 20 s (`app/reels/page.tsx` L272). */
const POLL_MS = 20_000;
const KEY = ["masayume", "takes"] as const;

async function fetchTakes(): Promise<TakesFeed> {
  const response = await fetch(`/api/takes?limit=${TAKES_FEED_LIMIT}`);
  if (!response.ok) throw new Error(`takes ${response.status}`);
  return (await response.json()) as TakesFeed;
}

/**
 * The community half of the reel. `null` until the first answer lands; a failed
 * refresh keeps the last feed on screen rather than dropping every take at once —
 * the reference's `.catch(() => {})` on reload, made explicit.
 */
export function useTakes(enabled: boolean): TakesFeed | null {
  const query = useQuery({
    queryKey: KEY,
    queryFn: fetchTakes,
    enabled,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
    staleTime: POLL_MS,
  });
  return query.data ?? null;
}

export interface PostTake {
  post: (input: { marketId: MarketId; side: Side; caption: string }) => Promise<FeedTake | null>;
  busy: boolean;
  error: string | null;
}

/**
 * Publishing a call: sign the exact message the route will verify, send it, and
 * refresh the reel with the server's own row rather than a local echo — what is on
 * screen is what was stored. The reference signs a transaction through its gas
 * sponsor; a `personal_sign` is the same proof without a chain write.
 */
export function usePostTake(): PostTake {
  const { address } = useWalletSession();
  const { signMessageAsync } = useSignMessage();
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const post = useCallback<PostTake["post"]>(
    async ({ marketId, side, caption }) => {
      if (!address) return null;
      setBusy(true);
      setError(null);
      try {
        const issuedAtMs = Date.now();
        const signature = await signMessageAsync({ message: takeMessage({ marketId, side, caption, address, issuedAtMs }) });
        const response = await fetch("/api/takes", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ marketId, side, caption, address, issuedAtMs, signature }),
        });
        const body = (await response.json()) as { take?: FeedTake; error?: string };
        if (!response.ok || !body.take) {
          setError(body.error ?? TAKE_ERRORS.postFailed);
          return null;
        }
        queryClient.setQueryData<TakesFeed>(KEY, (prior) => ({ configured: true, takes: [body.take!, ...(prior?.takes ?? [])] }));
        void queryClient.invalidateQueries({ queryKey: KEY });
        return body.take;
      } catch (cause) {
        // A rejected signature prompt is a choice, not a failure — say nothing.
        const rejected = /reject|denied|user cancel/i.test(String((cause as Error)?.message ?? ""));
        if (!rejected) setError(String((cause as Error)?.message ?? TAKE_ERRORS.postFailed).slice(0, 200));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [address, signMessageAsync, queryClient],
  );

  return { post, busy, error };
}
