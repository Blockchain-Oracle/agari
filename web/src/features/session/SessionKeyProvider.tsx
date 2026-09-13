"use client";

import { MARKETS_POLL_MS } from "@masayume/core/constants";
import type { TxOutcome } from "@masayume/core/ports";
import { diagnosis, type Address, type Hex } from "@masayume/core/types";
import { generateSessionKey, keyGasBalance, sessionGasTopUpWei, topUpSessionGas, type SubmitterSession } from "@masayume/markets";
import { keys, useUserSession, useVaultSnapshot } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNowMs } from "@/components/data";
import { useOwnerWalletClient } from "@/providers/UserSessionProvider";
import { useWalletSession } from "@/lib/wallet-session";
import { termsFromForm, termsFromGrant, type CapsForm } from "./caps";
import { forgetSessionKey, loadSessionKey, saveSessionKey, type StoredSessionKey } from "./store";
import { useKeySession } from "./useKeySession";
import { useSponsorStatus } from "./useSponsorStatus";
import { deriveStatus, isGrantLive, type EnableOutcome, type SessionBusy, type SessionKeyActions, type SessionKeyView } from "./view";

interface SessionKeyContextValue {
  view: SessionKeyView;
  session: SubmitterSession | null;
  actions: SessionKeyActions;
  busy: SessionBusy;
}

const SessionKeyContext = createContext<SessionKeyContextValue | null>(null);
const STORAGE_UNAVAILABLE = "this browser cannot keep a session key (storage unavailable)";

function refusedTx(technical: string): TxOutcome {
  return { status: "refused", diagnosis: diagnosis("unknown", technical) };
}

export function SessionKeyProvider({ children }: { children: ReactNode }) {
  const { address: owner } = useWalletSession();
  const userSession = useUserSession();
  const ownerWalletClient = useOwnerWalletClient();
  const queryClient = useQueryClient();
  const nowMs = useNowMs();
  const nowSec = Math.floor(nowMs / 1000);
  const snapshot = useVaultSnapshot(owner);
  const { status: sponsor, refresh: refreshSponsor } = useSponsorStatus();
  const [stored, setStored] = useState<{ owner: Address | null; key: StoredSessionKey | null; loaded: boolean }>({ owner: null, key: null, loaded: false });
  const [keyGasWei, setKeyGasWei] = useState<bigint | null>(null);
  const [busy, setBusy] = useState<SessionBusy>(null);

  // This browser's key for the connected owner, read once per owner.
  useEffect(() => {
    if (!owner) {
      setStored({ owner: null, key: null, loaded: true });
      return;
    }
    let cancelled = false;
    setStored({ owner, key: null, loaded: false });
    void loadSessionKey(owner).then((key) => {
      if (!cancelled) setStored({ owner, key, loaded: true });
    });
    return () => {
      cancelled = true;
    };
  }, [owner]);

  const value = snapshot?.ok ? snapshot.value : undefined;
  const deployment = value === undefined ? undefined : (value?.deployment ?? null);
  const grant = value === undefined ? undefined : (value?.grants.session ?? null);
  const key = stored.loaded && stored.owner === owner ? stored.key : null;
  const status = deriveStatus({ owner, deployment, grant, keyLoaded: stored.loaded && stored.owner === owner, key, nowSec: nowSec || Math.floor(Date.now() / 1000) });

  const { session, sponsorRefusal } = useKeySession({
    armed: status === "armed",
    privateKey: key?.privateKey ?? null,
    deployment: deployment ?? null,
    sponsorConfigured: sponsor?.configured ?? false,
  });

  // The key's STT, polled while a key exists: what it can pay for itself when no sponsor will.
  useEffect(() => {
    if (!key) {
      setKeyGasWei(null);
      return;
    }
    let cancelled = false;
    const read = () => keyGasBalance(key.address).then((wei) => !cancelled && setKeyGasWei(wei)).catch(() => undefined);
    void read();
    const id = setInterval(read, MARKETS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [key]);

  const invalidate = useCallback(async () => {
    if (!owner) return;
    await Promise.all([queryClient.invalidateQueries({ queryKey: keys.vault(owner) }), queryClient.invalidateQueries({ queryKey: keys.balanceSheet(owner) })]);
  }, [owner, queryClient]);

  const ensureKey = useCallback(async (): Promise<StoredSessionKey | null> => {
    if (!owner) return null;
    if (key) return key;
    const fresh = generateSessionKey(owner);
    const record: StoredSessionKey = { address: fresh.address, privateKey: fresh.privateKey, createdAtMs: fresh.createdAtMs };
    if (!(await saveSessionKey(owner, record))) return null;
    setStored({ owner, key: record, loaded: true });
    return record;
  }, [owner, key]);

  const topUpIfKeyPays = useCallback(
    async (to: Address): Promise<{ hash: Hex | null; error: string | null }> => {
      if (sponsor?.configured) return { hash: null, error: null };
      if (!ownerWalletClient) return { hash: null, error: "no wallet client to move STT from" };
      const required = sessionGasTopUpWei();
      const have = await keyGasBalance(to).catch(() => 0n);
      if (have >= required) return { hash: null, error: null };
      try {
        const hash = await topUpSessionGas({ ownerWalletClient, key: to, amountWei: required - have });
        setKeyGasWei(await keyGasBalance(to).catch(() => null));
        return { hash, error: null };
      } catch (error) {
        return { hash: null, error: error instanceof Error ? error.message : String(error) };
      }
    },
    [sponsor, ownerWalletClient],
  );

  const enable = useCallback(
    async (form: CapsForm): Promise<EnableOutcome> => {
      const submitter = userSession?.submitter;
      if (!submitter || !value) return { outcome: refusedTx("connect a wallet first"), topUpHash: null, topUpError: null };
      setBusy("enabling");
      try {
        const fresh = await ensureKey();
        if (!fresh) return { outcome: refusedTx(STORAGE_UNAVAILABLE), topUpHash: null, topUpError: null };
        const terms = termsFromForm(form, value.decimals, fresh.address, nowSec);
        if (!terms.ok) return { outcome: refusedTx(terms.error), topUpHash: null, topUpError: null };
        const outcome = await submitter.submitTx({ kind: "vault-deposit-and-grant", amountBase: terms.amountBase, terms: terms.terms });
        if (outcome.status !== "confirmed") return { outcome, topUpHash: null, topUpError: null };
        setBusy("topping-up");
        const topUp = await topUpIfKeyPays(fresh.address);
        await invalidate();
        return { outcome, topUpHash: topUp.hash, topUpError: topUp.error };
      } finally {
        setBusy(null);
      }
    },
    [userSession, value, ensureKey, nowSec, topUpIfKeyPays, invalidate],
  );

  const rekey = useCallback(async (): Promise<EnableOutcome> => {
    const submitter = userSession?.submitter;
    const live = grant ?? null;
    if (!submitter || !owner || !isGrantLive(live, nowSec)) return { outcome: refusedTx("no live grant to re-key"), topUpHash: null, topUpError: null };
    setBusy("rekeying");
    try {
      const fresh = generateSessionKey(owner);
      const record: StoredSessionKey = { address: fresh.address, privateKey: fresh.privateKey, createdAtMs: fresh.createdAtMs };
      if (!(await saveSessionKey(owner, record))) return { outcome: refusedTx(STORAGE_UNAVAILABLE), topUpHash: null, topUpError: null };
      // Replacing the grant returns the old budget before the new one is taken (the contract's own rule).
      const outcome = await submitter.submitTx({ kind: "vault-grant", terms: termsFromGrant(live, fresh.address) });
      if (outcome.status !== "confirmed") return { outcome, topUpHash: null, topUpError: null };
      setStored({ owner, key: record, loaded: true });
      const topUp = await topUpIfKeyPays(record.address);
      await invalidate();
      return { outcome, topUpHash: topUp.hash, topUpError: topUp.error };
    } finally {
      setBusy(null);
    }
  }, [userSession, owner, grant, nowSec, topUpIfKeyPays, invalidate]);

  const revoke = useCallback(async (): Promise<TxOutcome> => {
    const submitter = userSession?.submitter;
    if (!submitter || !grant) return refusedTx("nothing to revoke");
    setBusy("revoking");
    try {
      const outcome = await submitter.submitTx({ kind: "vault-revoke", grantId: grant.grantId });
      await invalidate();
      return outcome;
    } finally {
      setBusy(null);
    }
  }, [userSession, grant, invalidate]);

  const topUp = useCallback(async (): Promise<Hex | null> => {
    if (!key) return null;
    setBusy("topping-up");
    try {
      return (await topUpIfKeyPays(key.address)).hash;
    } finally {
      setBusy(null);
    }
  }, [key, topUpIfKeyPays]);

  const forget = useCallback(async () => {
    if (!owner) return;
    await forgetSessionKey(owner);
    setStored({ owner, key: null, loaded: true });
  }, [owner]);

  const view: SessionKeyView = useMemo(
    () => ({
      status,
      owner,
      key: key ? { address: key.address } : null,
      grant: grant ?? null,
      deployment: deployment ?? null,
      decimals: value?.decimals ?? 6,
      nowSec,
      sponsor,
      sponsorRefusal: sponsorRefusal(),
      keyGasWei,
      vaultAvailableBase: value?.account.availableBase ?? null,
    }),
    [status, owner, key, grant, deployment, value, nowSec, sponsor, sponsorRefusal, keyGasWei],
  );

  const actions = useMemo<SessionKeyActions>(() => ({ enable, rekey, revoke, topUp, forget }), [enable, rekey, revoke, topUp, forget]);
  useEffect(() => {
    if (status === "armed") refreshSponsor();
  }, [status, refreshSponsor]);

  return <SessionKeyContext.Provider value={{ view, session, actions, busy }}>{children}</SessionKeyContext.Provider>;
}

export function useSessionKey(): SessionKeyContextValue {
  const ctx = useContext(SessionKeyContext);
  if (!ctx) throw new Error("useSessionKey needs a SessionKeyProvider above it");
  return ctx;
}
