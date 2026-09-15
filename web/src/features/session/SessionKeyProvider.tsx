"use client";

import { MARKETS_POLL_MS } from "@agari/core/constants";
import type { TxOutcome } from "@agari/core/ports";
import { diagnosis, type Address, type Signature } from "@agari/core/types";
import { generateSessionKey, loadAccount, type SubmitterSession } from "@agari/markets";
import { keys, useUserSession, useVaultSnapshot } from "@agari/markets/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNowMs } from "@/components/data";
import { useWalletSession } from "@/lib/wallet-session";
import { termsFromForm, termsFromGrant, type CapsForm } from "./caps";
import { SESSION_KEY_TOPUP_LAMPORTS } from "./fees";
import { forgetSessionKey, loadSessionKey, saveSessionKey, type StoredSessionKey } from "./store";
import { useKeySession } from "./useKeySession";
import { useSponsorStatus } from "./useSponsorStatus";
import { deriveStatus, isGrantLive, type EnableOutcome, type SessionBusy, type SessionKeyActions, type SessionKeyView } from "./view";

interface SessionKeyContextValue {
  view: SessionKeyView;
  session: SubmitterSession | null;
  actions: SessionKeyActions;
  busy: SessionBusy;
  /** Asks for the sponsor's status while a sheet is open (audit P-11); returns the release. */
  demandSponsor: () => () => void;
}

const SessionKeyContext = createContext<SessionKeyContextValue | null>(null);
const STORAGE_UNAVAILABLE = "this browser cannot keep a session key (storage unavailable)";

function refusedTx(technical: string): TxOutcome {
  return { status: "refused", diagnosis: diagnosis("unknown", technical) };
}

/** A fresh non-extractable key (D-066) as its v2 record. */
async function freshKey(): Promise<StoredSessionKey> {
  const { address, keyPair } = await generateSessionKey();
  return { v: 2, address, keyPair, createdAtMs: Date.now() };
}

export function SessionKeyProvider({ children }: { children: ReactNode }) {
  const { address: owner } = useWalletSession();
  const userSession = useUserSession();
  const queryClient = useQueryClient();
  const nowMs = useNowMs();
  const nowSec = Math.floor(nowMs / 1000);
  const snapshot = useVaultSnapshot(owner);
  const [stored, setStored] = useState<{ owner: Address | null; key: StoredSessionKey | null; loaded: boolean }>({ owner: null, key: null, loaded: false });
  const [busy, setBusy] = useState<SessionBusy>(null);
  const [sponsorDemand, setSponsorDemand] = useState(0);

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
  const armed = status === "armed";
  const { status: sponsor, refresh: refreshSponsor, ensure: ensureSponsor } = useSponsorStatus(sponsorDemand > 0 || armed);

  const { session, sponsorRefusal } = useKeySession({ armed, sessionKey: key, deployment: deployment ?? null, sponsorConfigured: sponsor?.configured ?? false });

  // The key's own SOL, read every poll while it is armed: what it can pay when no sponsor will (tap-trading.md §1.1).
  const keyAddress = key?.address ?? null;
  const keyBalance = useQuery({
    queryKey: ["agari", "session", "keyLamports", keyAddress],
    queryFn: async () => (await loadAccount(keyAddress as string as Parameters<typeof loadAccount>[0])).lamports,
    enabled: armed && keyAddress !== null,
    refetchInterval: MARKETS_POLL_MS,
  });
  const keyFeeLamports: bigint | null = armed ? (keyBalance.data ?? null) : null;

  const invalidate = useCallback(async () => {
    if (!owner) return;
    await Promise.all([queryClient.invalidateQueries({ queryKey: keys.vault(owner) }), queryClient.invalidateQueries({ queryKey: keys.balanceSheet(owner) })]);
  }, [owner, queryClient]);

  const ensureKey = useCallback(async (): Promise<StoredSessionKey | null> => {
    if (!owner) return null;
    if (key) return key;
    const record = await freshKey();
    if (!(await saveSessionKey(owner, record))) return null;
    setStored({ owner, key: record, loaded: true });
    return record;
  }, [owner, key]);

  /** One wallet signature: open, deposit, grant — and, only when no sponsor pays the key's fees, its SOL in the same transaction. */
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
        const keyPays = !(await ensureSponsor()).configured;
        const outcome = await submitter.submitTx({
          kind: "vault-deposit-and-grant",
          amountBase: terms.amountBase,
          terms: terms.terms,
          ...(keyPays ? { keyTopUpLamports: SESSION_KEY_TOPUP_LAMPORTS } : {}),
        });
        if (outcome.status === "confirmed") await invalidate();
        return { outcome, topUpHash: null, topUpError: null };
      } finally {
        setBusy(null);
      }
    },
    [userSession, value, ensureKey, nowSec, ensureSponsor, invalidate],
  );

  const rekey = useCallback(async (): Promise<EnableOutcome> => {
    const submitter = userSession?.submitter;
    const live = grant ?? null;
    if (!submitter || !owner || !isGrantLive(live, nowSec)) return { outcome: refusedTx("no live grant to re-key"), topUpHash: null, topUpError: null };
    setBusy("rekeying");
    try {
      const record = await freshKey();
      if (!(await saveSessionKey(owner, record))) return { outcome: refusedTx(STORAGE_UNAVAILABLE), topUpHash: null, topUpError: null };
      // Replacing the grant returns the old budget before the new one is taken (the program's own rule, vault.md §3.3).
      const outcome = await submitter.submitTx({ kind: "vault-grant", terms: termsFromGrant(live, record.address) });
      if (outcome.status !== "confirmed") return { outcome, topUpHash: null, topUpError: null };
      setStored({ owner, key: record, loaded: true });
      await invalidate();
      return { outcome, topUpHash: null, topUpError: null };
    } finally {
      setBusy(null);
    }
  }, [userSession, owner, grant, nowSec, invalidate]);

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

  // The key's SOL arrives inside the enable transaction; a later top-up has no write in the port yet, so it moves nothing.
  const topUp = useCallback(async (): Promise<Signature | null> => null, []);

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
      keyFeeLamports,
      vaultAvailableBase: value?.account.availableBase ?? null,
    }),
    [status, owner, key, grant, deployment, value, nowSec, sponsor, sponsorRefusal, keyFeeLamports],
  );

  const actions = useMemo<SessionKeyActions>(() => ({ enable, rekey, revoke, topUp, forget }), [enable, rekey, revoke, topUp, forget]);
  const demandSponsor = useCallback(() => {
    setSponsorDemand((n) => n + 1);
    return () => setSponsorDemand((n) => n - 1);
  }, []);
  useEffect(() => {
    if (armed) refreshSponsor();
  }, [armed, refreshSponsor]);

  return <SessionKeyContext.Provider value={{ view, session, actions, busy, demandSponsor }}>{children}</SessionKeyContext.Provider>;
}

export function useSessionKey(): SessionKeyContextValue {
  const ctx = useContext(SessionKeyContext);
  if (!ctx) throw new Error("useSessionKey needs a SessionKeyProvider above it");
  return ctx;
}

/** Keeps the sponsor's status fresh while `open` (the enable and manage sheets), and asks nothing otherwise (P-11). */
export function useSponsorWhileOpen(open: boolean): void {
  const { demandSponsor } = useSessionKey();
  useEffect(() => (open ? demandSponsor() : undefined), [open, demandSponsor]);
}
