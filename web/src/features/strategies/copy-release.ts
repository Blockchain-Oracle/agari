import type { Address, Signature } from "@agari/core/types";
import type { VaultGrant } from "@agari/core/vault";
import { matchesProgressGrant, type CopyProgress } from "./copy-progress";
import type { CopyWriteResult } from "./copy-setup";

interface ReleasePorts {
  current: () => Promise<VaultGrant | null>;
  historical: (grantId: bigint) => Promise<VaultGrant>;
  receipt: (hash: Signature) => Promise<"success" | "reverted" | null>;
  revoke: (grantId: bigint) => Promise<CopyWriteResult>;
  save: (progress: CopyProgress | null) => void;
}

/** Reconcile the historical grant after an uncertain revoke, even when its live slot is empty. */
export async function releaseCopyPermission(pending: CopyProgress, owner: Address, ports: ReleasePorts): Promise<CopyWriteResult> {
  try {
    const grant = pending.grantId ? await ports.historical(BigInt(pending.grantId)) : await ports.current();
    if (!grant || grant.owner !== owner || grant.actor !== pending.runner) return { ok: false, reason: "This permission needs investigation before it can be released." };
    if (pending.grantId && grant.grantId.toString() === pending.grantId && grant.revoked) { ports.save(null); return { ok: true, ...(pending.releaseTx ? { txHash: pending.releaseTx } : {}) }; }
    if (!matchesProgressGrant(pending, grant)) return { ok: false, reason: "This permission needs investigation before it can be released." };
    if (pending.releasePending) {
      if (!pending.releaseTx || await ports.receipt(pending.releaseTx) !== "reverted") return { ok: false, reason: "The permission release is still being checked. It has not been resent." };
    }
    const releasing = { ...pending, grantId: grant.grantId.toString(), releasePending: true, releaseTx: null };
    ports.save(releasing);
    const result = await ports.revoke(grant.grantId);
    ports.save(result.ok ? null : { ...releasing, releasePending: Boolean(result.unknown), releaseTx: result.txHash ?? null });
    return result;
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "The permission release needs checking." };
  }
}
