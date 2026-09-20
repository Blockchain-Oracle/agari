import { isVaultIntent, type PhaseListener, type TxIntent, type TxOutcome } from "@agari/core/ports";
import { diagnosis } from "@agari/core/types";
import { notDeployed } from "../stub/not-deployed";
import { submitArenaTx } from "../games/write";
import { submitLeverageTx } from "../leverage/writes";
import { submitMakerTx } from "../maker/writes";
import { submitParlayTx } from "../parlay/writes";
import { submitPrivateTx } from "../private/writes";
import { submitRangeTx } from "../range/writes";
import { submitStrategyLane } from "../strategies/writes";
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
  if (intent.kind.startsWith("maker-")) return submitMakerTx(ctx, intent as never, onPhase);
  if (intent.kind.startsWith("strategy-")) return submitStrategyLane(ctx, intent as never, onPhase);
  if (intent.kind.startsWith("range-") && intent.kind !== "range-open") return submitRangeTx(ctx, intent as never, onPhase);
  // The open has its own lane (`submitParlayOpen`): it hands back the ticket id. Everything else is a plain write.
  if (intent.kind.startsWith("parlay-") && intent.kind !== "parlay-open") return submitParlayTx(ctx, intent as never, onPhase);
  // Likewise the boost: `submitLeverageOpen` hands back the position. Exits, the claim and liquidity are plain writes.
  if (intent.kind.startsWith("leverage-") && intent.kind !== "leverage-open") return submitLeverageTx(ctx, intent as never, onPhase);
  // The owner's own private writes and the permissionless settle. The desk's sends are the server-side service's.
  if (intent.kind.startsWith("private-")) return submitPrivateTx(ctx, intent as never, onPhase);
  // A duel's picks have their own lane (`submitArenaPick`): they report what filled. Every other arena write is a plain one.
  if (intent.kind.startsWith("arena-") && intent.kind !== "arena-pick" && intent.kind !== "arena-pick-for") return submitArenaTx(ctx, intent as never, onPhase);
  if (intent.kind === "faucet") return { status: "refused", diagnosis: diagnosis("faucet-refused", "test tUSDC comes from /api/faucet") };
  return { status: "refused", diagnosis: notDeployed() };
}
