/**
 * AD-3's second lane for agari-vault (tap-trading.md §1.2): plan from fresh reads → build (sponsor as fee payer when
 * the write is sponsorable) → simulate → journal → sign or co-sign → markSent → send → confirm, on the S4 tx lane
 * (D-033). `StaleGrantId` (7114) in simulation means another grant took the id: re-read and rebuild once.
 */
import type { PhaseListener, TxOutcome, VaultIntent } from "@agari/core/ports";
import { diagnosis, type Diagnosis } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { VAULT_NOT_DEPLOYED, type VaultDeployment } from "@agari/core/vault";
import { diagnose } from "../errors/error-map";
import { readVenueStatic } from "../runtime/accounts";
import { OrderRefusedError, SimulationFailedError } from "../submitter/errors";
import { checkGas } from "../submitter/fees";
import type { WriteContext } from "../submitter/settle-write";
import { forgetVaultAccount } from "./accounts";
import { buildPaid, sendPaid, type PaidWrite } from "./cosign";
import { loadVaultDeployment } from "./deployment";
import { VAULT_CODE, vaultCodeOf, vaultFailureDiagnosis } from "./errors";
import { planVaultIntent, VaultRefusal, type VaultPlan } from "./plan";

const refused = (diag: Diagnosis): TxOutcome => ({ status: "refused", diagnosis: diag });

/** The journal's one line (Masayume `summarizeVault`), written for the person who reads it back after a timeout. */
export function summarizeVault(intent: VaultIntent, decimals: number): string {
  const amount = (base: bigint) => formatBaseUnits(base, decimals);
  switch (intent.kind) {
    case "vault-deposit":
      return `deposit ${amount(intent.amountBase)} into the Trading Balance`;
    case "vault-withdraw":
      return `withdraw ${amount(intent.amountBase)} from the Trading Balance`;
    case "vault-move-private":
      return `move ${amount(intent.amountBase)} to the private balance`;
    case "vault-withdraw-private":
      return `withdraw ${amount(intent.amountBase)} from the private balance`;
    case "vault-grant":
      return `grant ${intent.terms.kind} to ${intent.terms.actor} with ${amount(intent.terms.budgetBase)}`;
    case "vault-deposit-and-grant":
      return `deposit ${amount(intent.amountBase)} and grant ${intent.terms.kind} to ${intent.terms.actor}`;
    case "vault-fund-grant":
      return `add ${amount(intent.amountBase)} to grant #${intent.grantId}`;
    case "vault-revoke":
      return `revoke grant #${intent.grantId}`;
    case "vault-key-top-up":
      return `top up the session key ${intent.key} with ${intent.lamports} lamports`;
    case "vault-crank-settle":
      return `settle ${intent.marketId} into ${intent.owner}'s Trading Balance`;
    case "vault-sweep":
      return "sweep the vault's seat credit";
  }
}

/** A refusal before anything was sent: the planner's, the program's (in simulation), or the lane's own. */
function notSentDiagnosis(error: unknown): Diagnosis {
  if (error instanceof VaultRefusal || error instanceof OrderRefusedError) return error.diagnosis;
  if (error instanceof SimulationFailedError) return vaultFailureDiagnosis(error.failure);
  return diagnose(error);
}

async function prepare(ctx: WriteContext, deployment: VaultDeployment, intent: VaultIntent): Promise<{ plan: VaultPlan; paid: PaidWrite }> {
  const nowSec = Math.floor(ctx.nowMs() / 1000);
  const once = async () => {
    forgetVaultAccount(ctx.wallet);
    const plan = await planVaultIntent(ctx, deployment, intent, nowSec);
    return { plan, paid: await buildPaid(ctx, plan.instructions, plan.sponsorable) };
  };
  try {
    return await once();
  } catch (error) {
    const stale = error instanceof SimulationFailedError && vaultCodeOf(error.failure) === VAULT_CODE.staleGrantId;
    if (!stale) throw error;
    return once();
  }
}

/** `submitTx` for every `vault-*` intent. Nothing is journaled until the plan and its simulation pass. */
export async function submitVaultTx(ctx: WriteContext, intent: VaultIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  let deployment: VaultDeployment | null;
  let prepared: Awaited<ReturnType<typeof prepare>>;
  let decimals: number;
  try {
    deployment = await loadVaultDeployment();
    if (!deployment) return refused(diagnosis("not-deployed", VAULT_NOT_DEPLOYED));
    [prepared, { decimals }] = await Promise.all([prepare(ctx, deployment, intent), readVenueStatic()]);
    if (!prepared.paid.sponsor) {
      const gas = await checkGas(ctx.rpc, ctx.wallet, "vault", prepared.plan.extraLamports);
      if (!gas.ok) return refused(gas.diagnosis);
    }
  } catch (error) {
    return refused(notSentDiagnosis(error));
  }

  const { plan, paid } = prepared;
  const record = await ctx.journal.record({ kind: intent.kind, wallet: ctx.wallet, summary: summarizeVault(intent, decimals), ...(plan.marketId ? { marketId: plan.marketId } : {}) });
  onPhase?.("submitted");
  const settled = await sendPaid(ctx, record.id, paid, onPhase);
  forgetVaultAccount(plan.owner);
  if (settled.kind === "not-sent") {
    onPhase?.("composing");
    return refused(notSentDiagnosis(settled.error));
  }
  const txHash = settled.signature;
  if (settled.kind === "unknown") {
    onPhase?.("unknown", { txHash });
    return { status: "unknown", diagnosis: diagnosis("send-unknown", `no confirmation (${settled.reason}); recovery will ask the chain`, { txHash }), txHash };
  }
  if (settled.kind === "landed-failed") {
    const diag = vaultFailureDiagnosis(settled.failure);
    await ctx.journal.markFailed(record.id, `landed: ${diag.technical}`);
    onPhase?.("reverted", { txHash });
    return { status: "reverted", diagnosis: { ...diag, txHash }, txHash };
  }
  await ctx.journal.markConfirmed(record.id);
  onPhase?.("confirmed", { txHash });
  return { status: "confirmed", txHash };
}
