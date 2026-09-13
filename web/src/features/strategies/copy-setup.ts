import type { Address, Hex } from "@masayume/core/types";
import type { VaultCaps, VaultGrant } from "@masayume/core/vault";
import { matchesProgressGrant, type CopyProgress } from "./copy-progress";

export interface CopyWriteResult { ok: boolean; txHash?: Hex; reason?: string; stage?: "grant" | "subscribe"; unknown?: boolean }
export interface CopySetupInput { strategyId: bigint; runner: Address; depositBase: bigint; budgetBase: bigint; caps: VaultCaps; feeBase: bigint }
export interface CopySetupPorts {
  load: () => CopyProgress | null;
  save: (progress: CopyProgress | null) => void;
  strategy: () => Promise<{ active: boolean; runner: string; feeBase: bigint } | null>;
  grant: () => Promise<{ current: VaultGrant | null } | null>;
  createGrant: (expiresAtSec: number) => Promise<CopyWriteResult>;
  subscribed: (grantId: string) => Promise<boolean>;
  receipt: (hash: Hex) => Promise<"success" | "reverted" | null>;
  subscribe: (grantId: bigint) => Promise<CopyWriteResult>;
  nowSec: number;
}

/** Saved before each signature; uncertain writes are reconciled without repeating either charge. */
export async function completeCopySetup(input: CopySetupInput, ports: CopySetupPorts): Promise<CopyWriteResult> {
  try {
    let progress = ports.load();
    if (progress?.releasePending) return { ok: false, reason: "A permission release is being checked. Use Check permission release before starting another copy." };
    if (progress && progress.strategyId !== input.strategyId.toString()) return { ok: false, reason: `Finish or release the unfinished copy of strategy #${progress.strategyId} first.` };
    if (progress?.stage === "subscribe-pending") {
      if (progress.grantId && await ports.subscribed(progress.grantId)) {
        ports.save(null);
        return { ok: true, ...(progress.subscribeTx ? { txHash: progress.subscribeTx as Hex } : {}) };
      }
      if (!progress.subscribeTx) return { ok: false, reason: "The subscription result is unknown. Check your wallet activity before another subscription; it has not been resent.", stage: "subscribe" };
      const receipt = await ports.receipt(progress.subscribeTx as Hex);
      if (receipt !== "reverted") return { ok: false, reason: "The subscription is still being reconciled. It has not been resent.", stage: "subscribe" };
      progress = { ...progress, stage: "subscribe-ready", subscribeTx: null };
      ports.save(progress);
    }
    const current = await ports.strategy();
    if (!current) return { ok: false, reason: "The current strategy fee and runner could not be checked. No new transaction was requested." };
    if (!current.active) return { ok: false, reason: "This strategy is inactive." };
    if (current.runner.toLowerCase() !== input.runner.toLowerCase() || (progress && progress.runner.toLowerCase() !== input.runner.toLowerCase())) return { ok: false, reason: "The runner changed. Review and release the old permission before starting a new setup." };
    if (current.feeBase !== input.feeBase) return { ok: false, reason: "The subscription fee changed. Review the current fee and confirm again." };
    const fresh = await ports.grant();
    if (!fresh) return { ok: false, reason: "Your current trading permission could not be checked." };
    let grant = fresh.current;
    if (!progress) {
      progress = { strategyId: input.strategyId.toString(), runner: input.runner, stage: "grant-pending", previousGrantId: grant?.grantId.toString() ?? null, grantId: null, grantTx: null, subscribeTx: null, budgetBase: input.budgetBase.toString(), feeBase: input.feeBase.toString(), expiresAtSec: ports.nowSec + 30 * 24 * 3600, caps: { maxStakePerTradeBase: input.caps.maxStakePerTradeBase.toString(), maxDailySpendBase: input.caps.maxDailySpendBase.toString(), maxOpenPositions: input.caps.maxOpenPositions, maxPriceRaw: input.caps.maxPriceRaw.toString() } };
      ports.save(progress);
      const granted = await ports.createGrant(progress.expiresAtSec);
      if (!granted.ok) {
        ports.save(granted.unknown ? { ...progress, grantTx: granted.txHash ?? null } : null);
        return { ...granted, stage: "grant" };
      }
      progress = { ...progress, grantTx: granted.txHash ?? null };
      ports.save(progress);
      grant = (await ports.grant())?.current ?? null;
    }
    if (!matchesProgressGrant(progress, grant)) {
      if (progress.stage === "grant-pending" && progress.grantTx && await ports.receipt(progress.grantTx as Hex) === "reverted") {
        ports.save(null);
        return { ok: false, reason: "The permission transaction reverted. Its deposit did not take effect; review the setup before trying again.", stage: "grant", txHash: progress.grantTx as Hex };
      }
      return { ok: false, reason: "The permission transaction needs checking, or its grant was replaced. No funds were deposited again.", stage: "grant", ...(progress.grantTx ? { txHash: progress.grantTx as Hex } : {}) };
    }
    if (grant!.expiresAtSec <= ports.nowSec) return { ok: false, reason: "The saved permission expired. Release it before creating a new one.", stage: "grant" };
    progress = { ...progress, stage: "subscribe-ready", grantId: grant!.grantId.toString(), feeBase: input.feeBase.toString() };
    ports.save(progress);
    const feeCheck = await ports.strategy();
    if (!feeCheck?.active || feeCheck.feeBase !== input.feeBase || feeCheck.runner.toLowerCase() !== progress.runner.toLowerCase()) return { ok: false, reason: "Review the current subscription fee and runner before completing the second step.", stage: "subscribe" };
    ports.save({ ...progress, stage: "subscribe-pending" });
    const subscribed = await ports.subscribe(grant!.grantId);
    ports.save(subscribed.ok ? null : { ...progress, stage: subscribed.unknown ? "subscribe-pending" : "subscribe-ready", subscribeTx: subscribed.txHash ?? null });
    return { ...subscribed, stage: "subscribe" };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "The copy setup needs checking. Your progress has been kept." };
  }
}
