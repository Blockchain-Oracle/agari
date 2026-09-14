import type { PhaseListener, TxIntent, TxOutcome } from "@agari/core/ports";
import { diagnosis } from "@agari/core/types";
import { notDeployed } from "../stub/not-deployed";
import { submitRedeem } from "./redeem-lane";
import type { WriteContext } from "./settle-write";

/**
 * Every non-order write (AD-3 second lane). S4 sends `redeem`; test tUSDC is minted server-side (D-034), so a wallet
 * `faucet` intent refuses; every product write refuses until its program is deployed (first-call.md §3.2).
 */
export async function submitTx(ctx: WriteContext, intent: TxIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  if (intent.kind === "redeem") return submitRedeem(ctx, intent, onPhase);
  if (intent.kind === "faucet") return { status: "refused", diagnosis: diagnosis("faucet-refused", "test tUSDC comes from /api/faucet") };
  return { status: "refused", diagnosis: notDeployed() };
}
