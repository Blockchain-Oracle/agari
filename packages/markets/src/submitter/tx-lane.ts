import { isVaultIntent, type PhaseListener, type TxIntent, type TxOutcome } from "@agari/core/ports";
import { diagnosis } from "@agari/core/types";
import { notDeployed } from "../stub/not-deployed";
import { submitVaultTx } from "../vault/write";
import { submitCancel } from "./cancel-lane";
import { submitRedeem } from "./redeem-lane";
import type { WriteContext } from "./settle-write";

/**
 * Every non-order write (AD-3 second lane). S4 sends `redeem`; test tUSDC is minted server-side (D-034), so a wallet
 * `faucet` intent refuses; S7 sends every `vault-*` intent through agari-vault (tap-trading.md §1.2); every other product
 * write refuses until its program is deployed (first-call.md §3.2).
 */
export async function submitTx(ctx: WriteContext, intent: TxIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  if (intent.kind === "redeem") return submitRedeem(ctx, intent, onPhase);
  if (intent.kind === "cancel-orders") return submitCancel(ctx, intent, onPhase);
  if (isVaultIntent(intent)) return submitVaultTx(ctx, intent, onPhase);
  if (intent.kind === "faucet") return { status: "refused", diagnosis: diagnosis("faucet-refused", "test tUSDC comes from /api/faucet") };
  return { status: "refused", diagnosis: notDeployed() };
}
