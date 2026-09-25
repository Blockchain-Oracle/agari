import { MARKETS_POLL_MS } from "@agari/core/constants";
import type { TxOutcome } from "@agari/core/ports";
import { diagnosis, type Address, type Signature } from "@agari/core/types";
import { loadAccount, type SubmitterSession } from "@agari/markets";
import { keys, useUserSession, useVaultSnapshot } from "@agari/markets/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useNowMs } from "@/components/data/useNowMs";
import { termsFromForm, termsFromGrant, type CapsForm } from "@/features/session/caps";
import { SESSION_KEY_TOPUP_LAMPORTS } from "@/features/session/fees";
import type { StoredSessionKey } from "@/features/session/store";
import { deriveStatus, isGrantLive, type EnableOutcome, type SessionBusy, type SessionKeyActions, type SessionKeyView } from "@/features/session/view";
import { useWalletSession } from "@/lib/wallet-session";
import { useSponsorStatus } from "~/features/session-key/sponsor";
import { useKeySession } from "~/features/session-key/useKeySession";
import { createSessionKey, forgetSessionKey, loadSessionKey } from "~/wallet/session-key-store";

/**
 * Stands in for web/src/features/session/SessionKeyProvider.tsx, line for line, with the phone's key store (D-128):
 * web keeps a non-extractable WebCrypto pair in IndexedDB; the app keeps the key's 32-byte seed in the Keychain /
 * Keystore (`~/wallet/session-key-store`) and imports it non-extractable to sign. Everything else — the status, the
 * one-signature arm (open, deposit, grant, and the key's SOL when no sponsor pays), re-key, revoke, top-up, forget,
 * the sponsored key session — is web's.
 */
interface SessionKeyContextValue {
  view: SessionKeyView;
  session: SubmitterSession | null;
  actions: SessionKeyActions;
  busy: SessionBusy;
  demandSponsor: () => () => void;
}

const SessionKeyContext = createContext<SessionKeyContextValue | null>(null);
const STORAGE_UNAVAILABLE = "this phone cannot keep a session key (secure storage unavailable)";

function refusedTx(technical: string): TxOutcome {
  return { status: "refused", diagnosis: diagnosis("unknown", technical) };
}

const keyLamportsKey = (key: Address | null) => ["agari", "session", "keyLamports", key] as const;

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

  // This phone's key for the connected owner, read once per owner.
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

  // The key's own SOL, read every poll while it is armed: what it can pay when no sponsor will.
  const keyAddress = key?.address ?? null;
  const keyBalance = useQuery({
    queryKey: keyLamportsKey(keyAddress),
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
    const record = await createSessionKey(owner);
    if (!record) return null;
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
      // web writes the fresh key before the re-grant; so does the phone (the old seed is replaced in the Keychain).
      const record = await createSessionKey(owner);
      if (!record) return { outcome: refusedTx(STORAGE_UNAVAILABLE), topUpHash: null, topUpError: null };
      const keyPays = !(await ensureSponsor()).configured;
      // Replacing the grant returns the old budget before the new one is taken (the program's own rule, vault.md §3.3).
      const outcome = await submitter.submitTx({
        kind: "vault-grant",
        terms: termsFromGrant(live, record.address),
        ...(keyPays ? { keyTopUpLamports: SESSION_KEY_TOPUP_LAMPORTS } : {}),
      });
      if (outcome.status !== "confirmed") return { outcome, topUpHash: null, topUpError: null };
      setStored({ owner, key: record, loaded: true });
      await invalidate();
      return { outcome, topUpHash: null, topUpError: null };
    } finally {
      setBusy(null);
    }
  }, [userSession, owner, grant, nowSec, ensureSponsor, invalidate]);

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

  /** The manager's "Move 0.01 SOL to the key": one owner-signed transfer to the armed key that pays its own fees. */
  const topUp = useCallback(async (): Promise<Signature | null> => {
    const submitter = userSession?.submitter;
    if (!submitter || !key) return null;
    setBusy("topping-up");
    try {
      const outcome = await submitter.submitTx({ kind: "vault-key-top-up", key: key.address, lamports: SESSION_KEY_TOPUP_LAMPORTS });
      if (outcome.status !== "confirmed") return null;
      await queryClient.invalidateQueries({ queryKey: keyLamportsKey(key.address) });
      return outcome.txHash;
    } finally {
      setBusy(null);
    }
  }, [userSession, key, queryClient]);

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
