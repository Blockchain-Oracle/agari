"use client";

import type { TxOutcome } from "@masayume/core/ports";
import type { StrategyIntent } from "@masayume/core/strategies";
import type { Address } from "@masayume/core/types";
import { isOk } from "@masayume/core/schemas";
import { invalidateAfterWrite, useSubmitter, useVaultSnapshot } from "@masayume/markets/react";
import { getClient } from "@masayume/markets/runtime";
import { getStrategy, listSubscriptionsOf, submitStrategyTx } from "@masayume/markets/strategies";
import { getVaultGrant, getVaultSnapshot, resolveVaultDeployment, type VaultContracts } from "@masayume/markets/vault";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicClient } from "viem";
import { webEnv } from "@/lib/env";
import { useOwnerWalletClient } from "@/providers/UserSessionProvider";
import { useWalletSession } from "@/lib/wallet-session";
import { useRefreshStrategies } from "./useStrategies";
import { copyProgressKey, parseCopyProgress, type CopyProgress } from "./copy-progress";
import { completeCopySetup, type CopySetupInput, type CopyWriteResult } from "./copy-setup";
import { releaseCopyPermission } from "./copy-release";

export type DeskBusy = "join" | "add" | "withdraw" | "caps" | "pause" | "resume" | "publish" | null;

export type DeskWriteResult = CopyWriteResult;

function failed(outcome: TxOutcome): DeskWriteResult {
  if (outcome.status === "confirmed") return { ok: true, txHash: outcome.txHash };
  return { ok: false, unknown: outcome.status === "unknown", reason: outcome.diagnosis.technical, ...("txHash" in outcome && outcome.txHash ? { txHash: outcome.txHash } : {}) };
}

/**
 * Every desk action, each its own small transaction. Joining is two signatures on this chain —
 * the vault's `depositAndGrant` (fund + limits, one call) and the registry's `subscribe` — the
 * reference composed both into one PTB, which the EVM cannot do without a batching contract.
 */
export function useDeskWrites() {
  const submitter = useSubmitter();
  const walletClient = useOwnerWalletClient();
  const { address } = useWalletSession();
  const snapshot = useVaultSnapshot(address);
  const queryClient = useQueryClient();
  const refresh = useRefreshStrategies();
  const [busy, setBusy] = useState<DeskBusy>(null);
  const executing = useRef(false);
  const [pending, setPending] = useState<CopyProgress | null>(null);
  const deployment = resolveVaultDeployment(webEnv.markets);
  const storageKey = address && deployment ? copyProgressKey(address, deployment.eventVault) : null;
  useEffect(() => {
    try { setPending(storageKey ? parseCopyProgress(localStorage.getItem(storageKey)) : null); } catch { setPending(null); }
  }, [storageKey]);
  const remember = useCallback((progress: CopyProgress | null) => {
    if (!storageKey) throw new Error("Connect your wallet before setting up a copy.");
    // Persist before requesting a signature. If storage is blocked, never start a flow we cannot recover.
    if (progress) localStorage.setItem(storageKey, JSON.stringify(progress));
    else localStorage.removeItem(storageKey);
    setPending(progress);
  }, [storageKey]);

  const contracts = useCallback((): VaultContracts | null => {
    if (!walletClient) return null;
    return { walletClient, publicClient: getClient().getViemClient() as PublicClient, deployment: resolveVaultDeployment(webEnv.markets) };
  }, [walletClient]);

  const registry = useCallback(
    async (intent: StrategyIntent): Promise<DeskWriteResult> => {
      if (!submitter || !address) return { ok: false, reason: "connect a wallet first" };
      const c = contracts();
      if (!c) return { ok: false, reason: "wallet is not on Somnia Shannon" };
      return failed(await submitStrategyTx({ journal: submitter.journal, wallet: address, contracts: c }, intent));
    },
    [submitter, address, contracts],
  );

  const settle = useCallback(async () => {
    if (address) await invalidateAfterWrite(queryClient, { wallet: address });
    refresh();
  }, [address, queryClient, refresh]);

  const run = useCallback(
    async (kind: DeskBusy, body: () => Promise<DeskWriteResult>): Promise<DeskWriteResult> => {
      if (executing.current) return { ok: false, reason: "Finish the current wallet action first." };
      executing.current = true;
      setBusy(kind);
      try {
        return await body();
      } catch (error) {
        return { ok: false, reason: error instanceof Error ? error.message : "The wallet action needs checking." };
      } finally {
        executing.current = false;
        setBusy(null);
        await settle().catch(() => undefined);
      }
    },
    [settle],
  );

  /** Fund + limits (one vault call), then consent on the registry. */
  const join = useCallback((input: CopySetupInput) => run("join", async () => {
    if (!submitter || !address) return { ok: false, reason: "connect a wallet first" };
    return completeCopySetup(input, {
      load: () => {
        const raw = storageKey ? localStorage.getItem(storageKey) : null;
        const saved = parseCopyProgress(raw);
        if (raw && !saved) throw new Error("Saved copy progress could not be read. Check your wallet activity before starting another setup.");
        return saved;
      },
      save: remember,
      strategy: async () => { const reading = await getStrategy(input.strategyId); return isOk(reading) && !reading.stale ? reading.value : null; },
      grant: async () => { const reading = await getVaultSnapshot(address); return isOk(reading) && !reading.stale && reading.value ? { current: reading.value.grants.strategy } : null; },
      createGrant: async (expiresAtSec) => {
        const terms = { kind: "strategy" as const, actor: input.runner, caps: input.caps, expiresAtSec, budgetBase: input.budgetBase };
        return failed(await submitter.submitTx(input.depositBase > 0n ? { kind: "vault-deposit-and-grant", amountBase: input.depositBase, terms } : { kind: "vault-grant", terms }));
      },
      subscribed: async (grantId) => { const reading = await listSubscriptionsOf(address, [input.strategyId]); return isOk(reading) && !reading.stale && reading.value.some((s) => s.active && s.grantId.toString() === grantId); },
      receipt: async (hash) => (await getClient().getViemClient().getTransactionReceipt({ hash }).catch(() => null))?.status ?? null,
      subscribe: (grantId) => registry({ kind: "strategy-subscribe", strategyId: input.strategyId, grantId, feeBase: input.feeBase }),
      nowSec: Math.floor(Date.now() / 1000),
    });
  }), [run, submitter, address, storageKey, remember, registry]);

  /** Pause stops new copies: the grant is revoked (budget back to the Vault), then the consent record closes. */
  const pause = useCallback(
    (strategyId: bigint, grantId: bigint) =>
      run("pause", async (): Promise<DeskWriteResult> => {
        if (!submitter) return { ok: false, reason: "connect a wallet first" };
        const fresh = address ? await getVaultSnapshot(address) : null;
        if (!fresh || !isOk(fresh) || fresh.stale) return { ok: false, reason: "Your current permission could not be checked." };
        if (fresh.value?.grants.strategy?.grantId === grantId && !fresh.value.grants.strategy.revoked) {
          const revoked = await submitter.submitTx({ kind: "vault-revoke", grantId });
          if (revoked.status !== "confirmed") return failed(revoked);
        }
        return registry({ kind: "strategy-unsubscribe", strategyId });
      }),
    [run, submitter, registry, address],
  );

  /** Add to the desk: the deposit lands in the Vault, then tops the live grant's budget. */
  const addMoney = useCallback(
    (grantId: bigint, amountBase: bigint) =>
      run("add", async (): Promise<DeskWriteResult> => {
        if (!submitter) return { ok: false, reason: "connect a wallet first" };
        const deposited = await submitter.submitTx({ kind: "vault-deposit", amountBase });
        if (deposited.status !== "confirmed") return failed(deposited);
        return failed(await submitter.submitTx({ kind: "vault-fund-grant", grantId, amountBase }));
      }),
    [run, submitter],
  );

  /** Existing vault funds can top up the current grant without another subscription fee. */
  const fundBudget = useCallback((grantId: bigint, amountBase: bigint) => run("add", async () => {
    if (!submitter || !address) return { ok: false, reason: "connect a wallet first" };
    const fresh = await getVaultSnapshot(address);
    if (!isOk(fresh) || fresh.stale || !fresh.value) return { ok: false, reason: "Your vault funds and permission could not be checked." };
    const grant = fresh.value.grants.strategy;
    if (!grant || grant.grantId !== grantId || grant.revoked || grant.expiresAtSec <= Math.floor(Date.now() / 1000)) return { ok: false, reason: "This permission is no longer current. Review it before adding funds." };
    if (amountBase <= 0n || amountBase > fresh.value.account.availableBase) return { ok: false, reason: "Deposit enough available funds in your Vault first." };
    return failed(await submitter.submitTx({ kind: "vault-fund-grant", grantId, amountBase }));
  }), [run, submitter, address]);

  /** Taking money off the desk revokes the grant first (the budget is the desk), then pays the owner. */
  const withdraw = useCallback(
    (grantId: bigint | null, amountBase: bigint) =>
      run("withdraw", async (): Promise<DeskWriteResult> => {
        if (!submitter) return { ok: false, reason: "connect a wallet first" };
        if (grantId !== null) {
          const revoked = await submitter.submitTx({ kind: "vault-revoke", grantId });
          if (revoked.status !== "confirmed") return failed(revoked);
        }
        return failed(await submitter.submitTx({ kind: "vault-withdraw", amountBase }));
      }),
    [run, submitter],
  );

  const publish = useCallback(
    (intent: Extract<StrategyIntent, { kind: "strategy-publish" }>) => run("publish", () => registry(intent)),
    [run, registry],
  );

  const releasePending = useCallback(() => run("pause", async (): Promise<DeskWriteResult> => {
    if (!pending || !address || !submitter) return { ok: false, reason: "No unfinished copy is selected." };
    return releaseCopyPermission(pending, address, {
      current: async () => { const reading = await getVaultSnapshot(address); if (!isOk(reading) || reading.stale || !reading.value) throw new Error("Your current permission could not be checked."); return reading.value.grants.strategy; },
      historical: getVaultGrant,
      receipt: async (hash) => (await getClient().getViemClient().getTransactionReceipt({ hash }).catch(() => null))?.status ?? null,
      revoke: async (grantId) => failed(await submitter.submitTx({ kind: "vault-revoke", grantId })),
      save: remember,
    });
  }), [run, pending, address, submitter, remember]);

  return { busy, join, pause, addMoney, fundBudget, withdraw, publish, pending, releasePending, snapshot, address, canSign: Boolean(submitter && walletClient) };
}
