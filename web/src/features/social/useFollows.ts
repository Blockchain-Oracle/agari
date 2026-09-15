"use client";

import type { Address } from "@agari/core/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { signText, useOwnerWallet, useWalletSession } from "@/lib/wallet-session";
import { SOCIAL_ERRORS } from "./copy";
import { FOLLOWS_STALE_MS, followsKey, socialSessionMessage, type FollowsPayload, type FollowWriteResult, type SocialSession } from "./protocol";
import { clearSocialToken, readSocialToken, writeSocialToken } from "./session-store";

async function fetchFollows(wallet: Address, signal: AbortSignal): Promise<FollowsPayload> {
  const response = await fetch(`/api/social/follows?wallet=${encodeURIComponent(wallet)}`, { signal });
  if (!response.ok) throw new Error(`follows ${response.status}`);
  return (await response.json()) as FollowsPayload;
}

/** One wallet's follow graph and counts. Not polled: a follow is the only thing that changes it, and a write sets it. */
export function useFollows(wallet: Address | null): { data: FollowsPayload | null; failed: boolean } {
  const query = useQuery({
    queryKey: followsKey(wallet),
    queryFn: ({ signal }) => fetchFollows(wallet as Address, signal),
    enabled: wallet !== null,
    staleTime: FOLLOWS_STALE_MS,
  });
  return { data: query.data ?? null, failed: query.isError };
}

export interface FollowToggle {
  /** Follows or unfollows; signs a social session first when there is none. True when the write landed. */
  setFollow: (followee: Address, follow: boolean) => Promise<boolean>;
  /** The followee whose write is in flight. */
  pending: Address | null;
  error: string | null;
}

const rejected = (cause: unknown) => /reject|denied|user cancel/i.test(String((cause as Error)?.message ?? ""));

/**
 * The follow write. One signature per hour: the session token is remembered per wallet, and a token the server no
 * longer accepts is dropped and signed for once more before giving up. The server's answer is written straight into
 * both wallets' cached graphs, so the button and both counts move with no refetch through the 10 s shared cache.
 */
export function useFollowToggle(): FollowToggle {
  const { address, connect } = useWalletSession();
  const wallet = useOwnerWallet();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<Address | null>(null);
  const [error, setError] = useState<string | null>(null);

  const openSession = useCallback(async (): Promise<string | null> => {
    if (!address || !wallet) return null;
    const issuedAtMs = Date.now();
    const signature = await signText(wallet, socialSessionMessage(address, issuedAtMs));
    const response = await fetch("/api/social/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address, issuedAtMs, signature }),
    });
    const body = (await response.json().catch(() => ({}))) as Partial<SocialSession> & { error?: string };
    if (!response.ok || !body.token || typeof body.expiresAtMs !== "number") {
      setError(body.error ?? SOCIAL_ERRORS.writeFailed);
      return null;
    }
    writeSocialToken(address, { token: body.token, expiresAtMs: body.expiresAtMs });
    return body.token;
  }, [address, wallet]);

  const setFollow = useCallback<FollowToggle["setFollow"]>(
    async (followee, follow) => {
      if (!address || !wallet) {
        connect();
        return false;
      }
      setPending(followee);
      setError(null);
      try {
        for (let attempt = 0; attempt < 2; attempt += 1) {
          const token = readSocialToken(address) ?? (await openSession());
          if (!token) return false;
          const response = await fetch("/api/social/follows", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ token, followee, follow }),
          });
          if (response.status === 401) {
            clearSocialToken(address);
            continue;
          }
          const body = (await response.json().catch(() => ({}))) as Partial<FollowWriteResult> & { error?: string };
          if (!response.ok || !body.follower || !body.followee) {
            setError(body.error ?? SOCIAL_ERRORS.writeFailed);
            return false;
          }
          const theirs = body.followee;
          queryClient.setQueryData<FollowsPayload>(followsKey(address), body.follower);
          queryClient.setQueryData<FollowsPayload>(followsKey(followee), (prior) => (prior ? { ...prior, counts: theirs.counts } : prior));
          return true;
        }
        setError(SOCIAL_ERRORS.notSignedIn);
        return false;
      } catch (cause) {
        // A declined signature prompt is a choice, not a failure: say nothing.
        if (!rejected(cause)) setError(SOCIAL_ERRORS.writeFailed);
        return false;
      } finally {
        setPending(null);
      }
    },
    [address, wallet, connect, openSession, queryClient],
  );

  return { setFollow, pending, error };
}
