"use client";

import { xLinkMessage, xUnlinkMessage } from "@masayume/core/x";
import { shortHex } from "@masayume/core/units";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSignMessage } from "wagmi";
import { useWalletSession } from "@/lib/wallet-session";
import { X_ERRORS, X_OAUTH_EXPIRED, X_OAUTH_FALLBACK, X_OAUTH_MESSAGES, xOauthRejected, X_CARD } from "./copy";
import { X_REASON_PARAM, X_RETURN_PARAM, type XStatus } from "./protocol";

export type XBusy = "" | "link" | "unlink";

export interface XLink {
  status: XStatus | null;
  loading: boolean;
  busy: XBusy;
  error: string;
  ok: string;
  /** Signed in with X, but this wallet is not the account's route yet (or it routes elsewhere). */
  needsLink: boolean;
  /** The account routes to a different wallet than the connected one — funding here would strand money. */
  walletMismatch: boolean;
  /** Signed in as the same account the wallet is routed to — the state that may disconnect. */
  sessionMatchesBinding: boolean;
  refresh: () => Promise<void>;
  link: () => Promise<void>;
  unlink: () => Promise<void>;
  startUrl: (returnTo: string) => string;
  setOk: (message: string) => void;
  setError: (message: string) => void;
}

async function fetchStatus(wallet: string | null): Promise<XStatus | null> {
  try {
    const q = wallet ? `?wallet=${encodeURIComponent(wallet)}` : "";
    const response = await fetch(`/api/x/status${q}`, { cache: "no-store" });
    return response.ok ? ((await response.json()) as XStatus) : null;
  } catch {
    return null;
  }
}

function bounceMessage(reason: string | null): string {
  if (reason?.startsWith("token_")) {
    const code = reason.slice("token_".length);
    return code === "invalid_grant" ? X_OAUTH_EXPIRED : xOauthRejected(code);
  }
  return X_OAUTH_MESSAGES[reason ?? ""] ?? X_OAUTH_FALLBACK;
}

/**
 * The link machine, ported from the reference's `XWalletCard.tsx`: the session says who is
 * signed in RIGHT HERE, the store says which account routes to a wallet on any device, and
 * both are needed before a mention can spend anything.
 */
export function useXStatus(): XLink {
  const { address } = useWalletSession();
  const { signMessageAsync } = useSignMessage();
  const [status, setStatus] = useState<XStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<XBusy>("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const refresh = useCallback(async () => {
    setStatus(await fetchStatus(address));
    setLoading(false);
  }, [address]);
  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(timer);
  }, [refresh]);

  const session = status?.session ?? null;
  const binding = status?.binding ?? null;
  const routedHere = Boolean(address && binding && binding.wallet === address.toLowerCase());
  const sessionMatchesBinding = Boolean(session && binding && session.authorId === binding.authorId);
  const walletMismatch = Boolean(address && binding && session && binding.authorId === session.authorId && binding.wallet !== address.toLowerCase());
  const needsLink = Boolean(address && session && !walletMismatch && (!routedHere || !sessionMatchesBinding));

  const link = useCallback(async () => {
    if (!address || !session || busy) return;
    setError("");
    setOk("");
    setBusy("link");
    try {
      const issuedAtMs = Date.now();
      const signature = await signMessageAsync({ message: xLinkMessage(session.authorId, address, issuedAtMs) });
      const response = await fetch("/api/x/bind", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: address, issuedAtMs, signature }) });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; reason?: string; boundWallet?: string };
      if (!response.ok || body.ok === false) {
        if (body.reason === X_ERRORS.alreadyLinkedOther && body.boundWallet) {
          throw new Error(`That X account is already pointed at ${shortHex(body.boundWallet)}. Connect that wallet instead.`);
        }
        throw new Error(body.reason || X_ERRORS.linkFailed);
      }
      setOk(X_CARD.linkedOk);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("");
    }
  }, [address, session, busy, signMessageAsync, refresh]);

  const unlink = useCallback(async () => {
    if (!address || !session || !sessionMatchesBinding || busy) return;
    setError("");
    setOk("");
    setBusy("unlink");
    try {
      const issuedAtMs = Date.now();
      const signature = await signMessageAsync({ message: xUnlinkMessage(session.authorId, address, issuedAtMs) });
      const response = await fetch("/api/x/unlink", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ wallet: address, issuedAtMs, signature }) });
      const body = (await response.json().catch(() => ({}))) as { ok?: boolean; reason?: string };
      if (!response.ok || body.ok === false) throw new Error(body.reason || X_ERRORS.unlinkFailed);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy("");
    }
  }, [address, session, sessionMatchesBinding, busy, signMessageAsync, refresh]);

  // Finish the job the sign-in started: OAuth bounces back with `?x=1` having only set a cookie.
  const autoLinked = useRef(false);
  useEffect(() => {
    if (autoLinked.current || loading || !needsLink) return;
    if (!new URLSearchParams(window.location.search).has(X_RETURN_PARAM)) return;
    autoLinked.current = true;
    void link();
  }, [loading, needsLink, link]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get(X_RETURN_PARAM) !== "err") return;
    setError(bounceMessage(params.get(X_REASON_PARAM)));
  }, []);

  const startUrl = useCallback((returnTo: string) => `/api/x/start?return=${encodeURIComponent(returnTo)}`, []);

  return { status, loading, busy, error, ok, needsLink, walletMismatch, sessionMatchesBinding, refresh, link, unlink, startUrl, setOk, setError };
}
