"use client";

import type { GrantTerms, TxOutcome } from "@masayume/core/ports";
import { diagnosisCopy } from "@masayume/core/copy";
import { formatBaseUnits } from "@masayume/core/units";
import type { VaultGrant } from "@masayume/core/vault";
import { X_GRANT, xGrantCaps, xPermissionState, type XPermissionState } from "@masayume/core/x";
import { getVaultSnapshot } from "@masayume/markets";
import { getClient } from "@masayume/markets/runtime";
import { invalidateAfterWrite, useSigner, useSubmitter, useVaultSnapshot } from "@masayume/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { decodeEventLog } from "viem";
import { X_CARD, X_HANDLE } from "./copy";
import { parseXUpdate, updateXPermission, type XUpdateProgress } from "./update-permission";

export { X_GRANT } from "@masayume/core/x";
const PROGRESS_EVENT = "masayume:x-permission-update";
const activeWrites = new Set<string>();
const revokedEvent = [{ type: "event", name: "GrantRevoked", inputs: [
  { name: "grantId", type: "uint256", indexed: true }, { name: "owner", type: "address", indexed: true },
  { name: "returned", type: "uint256", indexed: false },
] }] as const;
function subscribeProgress(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(PROGRESS_EVENT, listener);
  return () => { window.removeEventListener("storage", listener); window.removeEventListener(PROGRESS_EVENT, listener); };
}

export type XGrantBusy = "" | "fund" | "cashout" | "update";

export interface XGrantState {
  /** null while unread; the vault's own reading says whether it is deployed here. */
  deployed: boolean | null;
  decimals: number;
  /** The current non-revoked EXECUTOR grant, including an expired grant with funds to recover. */
  grant: VaultGrant | null;
  /** Funds still allocated to X. Permission readiness is shown separately. */
  balanceBase: bigint | null;
  availableBase: bigint | null;
  readable: boolean;
  pendingUpdate: XUpdateProgress | null;
  busy: XGrantBusy;
  error: string;
  ok: string;
  fund: (amountBase: bigint, executor: string | null, source?: "wallet" | "trading-balance") => Promise<void>;
  update: (executor: string | null) => Promise<void>;
  keepReturnedFunds: () => void;
  permission: (executor: string | null) => XPermissionState;
  cashOut: () => Promise<void>;
  clear: () => void;
}

function outcomeError(outcome: TxOutcome): string | null {
  if (outcome.status === "confirmed") return null;
  return diagnosisCopy(outcome.diagnosis.kind).headline;
}

/**
 * The X betting balance, as an EXECUTOR grant on the EventVault: fund = deposit + grant in one
 * transaction the first time (then deposit + top-up), cash out = revoke, which returns the
 * budget to the wallet's Trading Balance rather than to the wallet itself.
 */
export function useXGrant(): XGrantState {
  const { address } = useSigner();
  const submitter = useSubmitter();
  const queryClient = useQueryClient();
  const snapshot = useVaultSnapshot(address);
  const [busy, setBusy] = useState<XGrantBusy>("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const value = snapshot && snapshot.ok ? snapshot.value : null;
  const readable = Boolean(snapshot?.ok && !snapshot.stale && value);
  const deployed = snapshot && snapshot.ok ? value !== null : null;
  const decimals = value?.decimals ?? 6;
  const grant = value?.grants.executor ?? null;
  const current = grant && !grant.revoked ? grant : null;
  const storageKey = address && value ? `masayume:x-update:v1:${value.deployment.chainId}:${value.deployment.eventVault.toLowerCase()}:${address.toLowerCase()}` : null;
  const readProgress = useCallback(() => { try { return storageKey ? localStorage.getItem(storageKey) : null; } catch { return null; } }, [storageKey]);
  const saved = useSyncExternalStore(subscribeProgress, readProgress, () => null);
  const pendingUpdate = parseXUpdate(saved);
  const executing = useRef(false);
  const begin = () => {
    if (!submitter || !address || executing.current || activeWrites.has(address)) return false;
    executing.current = true;
    activeWrites.add(address);
    return true;
  };
  const finish = async () => {
    executing.current = false;
    if (address) activeWrites.delete(address);
    setBusy("");
    if (address) await invalidateAfterWrite(queryClient, { wallet: address }).catch(() => undefined);
  };
  const permission = (executor: string | null): XPermissionState => {
    if (!snapshot) return "checking";
    if (!readable || saved && !pendingUpdate) return "unavailable";
    if (pendingUpdate) return "update";
    return xPermissionState(current, executor, Math.floor(Date.now() / 1000));
  };

  const clear = useCallback(() => {
    setError("");
    setOk("");
  }, []);

  const fund = async (amountBase: bigint, executor: string | null, source: "wallet" | "trading-balance" = "wallet") => {
      if (!submitter || !address) return;
      clear();
      if (!readable) return setError(X_CARD.balanceUnavailable);
      if (saved) return setError(X_CARD.finishUpdate);
      if (!executor) return setError(X_CARD.noExecutor);
      if (amountBase <= 0n) return setError(X_CARD.enterAmount);
      if (!begin()) return;
      setBusy("fund");
      try {
        const fresh = await getVaultSnapshot(address);
        if (!fresh.ok || fresh.stale || !fresh.value) throw new Error(X_CARD.balanceUnavailable);
        const existing = fresh.value.grants.executor;
        const state = xPermissionState(existing, executor, Math.floor(Date.now() / 1000));
        if (["update", "expired", "mismatch"].includes(state)) throw new Error(X_CARD.finishUpdate);
        if (source === "trading-balance" && fresh.value.account.availableBase < amountBase) throw new Error(X_CARD.availableShort);
        const caps = xGrantCaps();
        const expiresAtSec = Math.floor(Date.now() / 1000) + X_GRANT.days * 86_400;
        const terms: GrantTerms = { kind: "executor", actor: executor as GrantTerms["actor"], caps, expiresAtSec, budgetBase: amountBase };
        if (existing && !existing.revoked) {
          if (source === "wallet") {
            const deposit = await submitter.submitTx({ kind: "vault-deposit", amountBase });
            const failed = outcomeError(deposit);
            if (failed) throw new Error(failed);
          }
          const topUp = await submitter.submitTx({ kind: "vault-fund-grant", grantId: existing.grantId, amountBase });
          const failedTopUp = outcomeError(topUp);
          if (failedTopUp) throw new Error(source === "wallet" ? `${failedTopUp} ${X_CARD.depositReturned}` : failedTopUp);
        } else {
          const outcome = await submitter.submitTx(source === "wallet" ? { kind: "vault-deposit-and-grant", amountBase, terms } : { kind: "vault-grant", terms });
          const failed = outcomeError(outcome);
          if (failed) throw new Error(failed);
        }
        setOk(X_CARD.funded(formatBaseUnits(amountBase, decimals), X_HANDLE));
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        await finish();
      }
  };

  const update = async (executor: string | null) => {
    if (!submitter || !address || !storageKey || !value) return;
    clear();
    if (!readable) return setError(X_CARD.balanceUnavailable);
    if (!executor) return setError(X_CARD.noExecutor);
    if (!begin()) return;
    setBusy("update");
    try {
      await updateXPermission(address, executor as GrantTerms["actor"], {
        load: () => {
          const raw = localStorage.getItem(storageKey);
          const parsed = parseXUpdate(raw);
          if (raw && !parsed) throw new Error(X_CARD.updateUnreadable);
          return parsed;
        },
        save: (progress) => {
          if (progress) localStorage.setItem(storageKey, JSON.stringify(progress));
          else localStorage.removeItem(storageKey);
          window.dispatchEvent(new Event(PROGRESS_EVENT));
        },
        snapshot: async () => {
          const fresh = await getVaultSnapshot(address);
          return fresh.ok && !fresh.stale && fresh.value ? { grant: fresh.value.grants.executor, availableBase: fresh.value.account.availableBase } : null;
        },
        submit: (intent) => submitter.submitTx(intent),
        receipt: async (hash, oldGrantId) => {
          const receipt = await getClient().getViemClient().getTransactionReceipt({ hash }).catch(() => null);
          if (!receipt) return null;
          let returnedBase: bigint | undefined;
          for (const log of receipt.logs) {
            if (log.address.toLowerCase() !== value.deployment.eventVault.toLowerCase()) continue;
            try {
              const event = decodeEventLog({ abi: revokedEvent, data: log.data, topics: log.topics });
              if (event.args.grantId === oldGrantId && event.args.owner.toLowerCase() === address.toLowerCase()) returnedBase = event.args.returned;
            } catch { /* A receipt can contain unrelated token/vault events. */ }
          }
          return { status: receipt.status, returnedBase };
        },
        nowSec: () => Math.floor(Date.now() / 1000),
      });
      setOk(X_CARD.updated);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : X_CARD.updateUnreadable);
    } finally { await finish(); }
  };

  const keepReturnedFunds = () => {
    if (!storageKey || executing.current || address && activeWrites.has(address)) return;
    try {
      if (parseXUpdate(localStorage.getItem(storageKey))?.stage !== "grant-ready") return;
      localStorage.removeItem(storageKey);
      window.dispatchEvent(new Event(PROGRESS_EVENT));
      clear();
      setOk("Update stopped. The returned funds stay in your Trading Balance.");
    } catch { setError(X_CARD.updateUnreadable); }
  };

  const cashOut = async () => {
    if (!submitter || !address) return;
    clear();
    if (!readable) return setError(X_CARD.balanceUnavailable);
    if (saved) return setError(X_CARD.finishUpdate);
    if (!current || current.budgetBase <= 0n) return setError(X_CARD.nothingToCashOut);
    if (!begin()) return;
    setBusy("cashout");
    try {
      const outcome = await submitter.submitTx({ kind: "vault-revoke", grantId: current.grantId });
      const failed = outcomeError(outcome);
      if (failed) throw new Error(failed);
      setOk(X_CARD.cashedOut(formatBaseUnits(current.budgetBase, decimals)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      await finish();
    }
  };

  return {
    deployed,
    decimals,
    grant: current,
    balanceBase: current ? current.budgetBase : deployed ? 0n : null,
    availableBase: value ? value.account.availableBase : null,
    readable,
    pendingUpdate,
    permission,
    update,
    keepReturnedFunds,
    busy,
    error,
    ok,
    fund,
    cashOut,
    clear,
  };
}
