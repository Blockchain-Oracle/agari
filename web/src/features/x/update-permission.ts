import type { Submitter, TxOutcome } from "@masayume/core/ports";
import type { Address, Hex } from "@masayume/core/types";
import type { VaultGrant } from "@masayume/core/vault";
import { X_GRANT, xGrantCaps } from "@masayume/core/x";

export interface XUpdateProgress {
  version: 1;
  owner: Address;
  executor: Address;
  oldGrantId: string;
  stage: "revoke-ready" | "revoke-pending" | "grant-ready" | "grant-pending";
  returnedBase?: string;
  txHash?: Hex;
}

export function parseXUpdate(raw: string | null): XUpdateProgress | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as XUpdateProgress;
    if (p.version !== 1 || !/^0x[0-9a-fA-F]{40}$/.test(p.owner) || !/^0x[0-9a-fA-F]{40}$/.test(p.executor)
      || !/^[1-9]\d{0,77}$/.test(p.oldGrantId) || !["revoke-ready", "revoke-pending", "grant-ready", "grant-pending"].includes(p.stage)
      || (p.txHash !== undefined && !/^0x[0-9a-fA-F]{64}$/.test(p.txHash))
      || (p.returnedBase !== undefined && !/^(0|[1-9]\d{0,77})$/.test(p.returnedBase))
      || (p.stage.startsWith("grant") && p.returnedBase === undefined)) return null;
    return p;
  } catch { return null; }
}

export interface XUpdateDependencies {
  load: () => XUpdateProgress | null;
  save: (progress: XUpdateProgress | null) => void;
  snapshot: () => Promise<{ grant: VaultGrant | null; availableBase: bigint } | null>;
  submit: Submitter["submitTx"];
  receipt: (hash: Hex, oldGrantId: bigint) => Promise<{ status: "success" | "reverted"; returnedBase?: bigint } | null>;
  nowSec: () => number;
}

export const X_UPDATE_PENDING = "Your update needs checking. Check wallet activity before starting another transaction.";

/** Pause first, then reuse the exact GrantRevoked amount. A relay fill while the
 * owner signs cannot make renewal take extra funds from the general Trading Balance.
 * Persist each pending step before sending; a retry checks its receipt, never replays it.
 */
export async function updateXPermission(owner: Address, executor: Address, deps: XUpdateDependencies): Promise<void> {
  let progress = deps.load();
  if (progress && (progress.owner.toLowerCase() !== owner.toLowerCase() || progress.executor.toLowerCase() !== executor.toLowerCase())) {
    throw new Error("Reconnect the wallet and X executor used to start this update.");
  }
  if (!progress) {
    const state = await deps.snapshot();
    if (!state?.grant || state.grant.revoked) throw new Error("Your X permission could not be checked. Refresh and try again.");
    progress = { version: 1, owner, executor, oldGrantId: state.grant.grantId.toString(), stage: "revoke-ready" };
    deps.save(progress);
  }
  const rememberOutcome = (outcome: TxOutcome, ready: XUpdateProgress["stage"]) => {
    if (outcome.status === "confirmed" || outcome.status === "unknown") {
      progress = { ...progress!, txHash: "txHash" in outcome ? outcome.txHash : undefined };
      deps.save(progress);
      if (outcome.status === "unknown") throw new Error(X_UPDATE_PENDING);
    } else {
      progress = { ...progress!, stage: ready, txHash: undefined };
      deps.save(progress);
      throw new Error(outcome.diagnosis.kind === "user-rejected" ? "Wallet confirmation cancelled. Your update can be continued here." : "The wallet transaction failed. Your update can be continued here.");
    }
  };
  if (progress.stage === "revoke-ready") {
    const state = await deps.snapshot();
    if (state?.grant?.grantId.toString() !== progress.oldGrantId) throw new Error("Your X permission changed. Check it in Portfolio before continuing.");
    progress = { ...progress, stage: "revoke-pending" };
    deps.save(progress);
    rememberOutcome(await deps.submit({ kind: "vault-revoke", grantId: BigInt(progress.oldGrantId) }), "revoke-ready");
  }
  if (progress.stage === "revoke-pending") {
    if (!progress.txHash) throw new Error(X_UPDATE_PENDING);
    const receipt = await deps.receipt(progress.txHash, BigInt(progress.oldGrantId));
    if (!receipt) throw new Error(X_UPDATE_PENDING);
    if (receipt.status === "reverted") {
      deps.save({ ...progress, stage: "revoke-ready", txHash: undefined });
      throw new Error("The update transaction reverted. You can try the update again.");
    }
    if (receipt.returnedBase === undefined) throw new Error("The returned X balance could not be verified. Check wallet activity before continuing.");
    progress = { ...progress, stage: "grant-ready", returnedBase: receipt.returnedBase.toString(), txHash: undefined };
    deps.save(progress);
  }
  if (progress.stage === "grant-ready") {
    const state = await deps.snapshot();
    const budgetBase = BigInt(progress.returnedBase!);
    if (!state) throw new Error("Your Trading Balance could not be checked. Try again shortly.");
    if (state.grant && !state.grant.revoked) throw new Error("Another X permission is already active. Check it in Portfolio before continuing.");
    if (state.availableBase < budgetBase) throw new Error("The returned funds are no longer all available in your Trading Balance. Check Portfolio before continuing.");
    progress = { ...progress, stage: "grant-pending", txHash: undefined };
    deps.save(progress);
    rememberOutcome(await deps.submit({ kind: "vault-grant", terms: {
      kind: "executor", actor: executor, caps: xGrantCaps(), budgetBase,
      expiresAtSec: deps.nowSec() + X_GRANT.days * 86_400,
    } }), "grant-ready");
  }
  if (progress.stage === "grant-pending") {
    if (!progress.txHash) throw new Error(X_UPDATE_PENDING);
    const receipt = await deps.receipt(progress.txHash, BigInt(progress.oldGrantId));
    if (!receipt) throw new Error(X_UPDATE_PENDING);
    if (receipt.status === "reverted") {
      deps.save({ ...progress, stage: "grant-ready", txHash: undefined });
      throw new Error("The new permission reverted. Your returned funds remain in Trading Balance; continue the update here.");
    }
    deps.save(null);
  }
}
