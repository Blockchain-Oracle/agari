import { getOwnerAllowInstructionAsync, getOwnerDepositAndAllowInstructionAsync, getOwnerRevokeInstructionAsync, getOwnerWithdrawInstructionAsync, getPublicSettleSlotInstructionAsync } from "@agari/clients/agari-private";
import type { PhaseListener, TxOutcome } from "@agari/core/ports";
import type { PrivateIntent } from "@agari/core/private";
import { diagnosis, type Address, type Hash32, type MarketId } from "@agari/core/types";
import { findAssociatedTokenPda, TOKEN_PROGRAM_ADDRESS } from "@solana-program/token";
import type { Instruction, TransactionSigner } from "@solana/kit";
import { readMarket } from "../runtime/accounts";
import { OrderRefusedError } from "../submitter/errors";
import { submitLaneWrite } from "../submitter/lane-write";
import type { WriteContext } from "../submitter/settle-write";
import { keyBytes, kit, privateProgramId } from "./deployment";
import { readDesk } from "./reads";

const config = () => ({ programAddress: kit(privateProgramId()) });

async function deskOrRefuse() {
  const desk = await readDesk();
  if (!desk) throw new OrderRefusedError(diagnosis("not-deployed", "no private desk on this cluster"));
  return desk;
}

/** `public_settle_slot` for one slot: permissionless, so the desk service and an owner's own wallet build the same instruction. */
export async function settleSlotInstruction(caller: TransactionSigner, slotId: Hash32, marketId: MarketId, collateralMint: string): Promise<Instruction> {
  const market = await readMarket(marketId);
  if (!market) throw new OrderRefusedError(diagnosis("market-not-trading", `Window not found: ${marketId}`));
  const { data } = market;
  return getPublicSettleSlotInstructionAsync({
    caller,
    series: kit(data.series as unknown as string),
    market: kit(marketId),
    ledger: kit(data.ledger as unknown as string),
    mvault: kit(data.mvault as unknown as string),
    collateralMint: kit(collateralMint),
    tokenProgram: TOKEN_PROGRAM_ADDRESS,
    slotId: keyBytes(slotId),
  }, config());
}

async function instructionFor(ctx: WriteContext, intent: PrivateIntent): Promise<Instruction> {
  const desk = await deskOrRefuse();
  const mint = desk.data.collateralMint;
  if (intent.kind === "private-settle") return settleSlotInstruction(ctx.signer, intent.slotId, intent.marketId, mint);
  if (intent.kind === "private-allow") return getOwnerAllowInstructionAsync({ owner: ctx.signer, allowanceBase: intent.allowanceBase }, config());
  if (intent.kind === "private-revoke") return getOwnerRevokeInstructionAsync({ owner: ctx.signer }, config());

  const [ownerToken] = await findAssociatedTokenPda({ owner: kit(ctx.wallet as Address), mint, tokenProgram: TOKEN_PROGRAM_ADDRESS });
  const funds = { owner: ctx.signer, ownerToken, collateralMint: mint, tokenProgram: TOKEN_PROGRAM_ADDRESS };
  return intent.kind === "private-deposit-and-allow"
    ? getOwnerDepositAndAllowInstructionAsync({ ...funds, amountBase: intent.amountBase, allowanceBase: intent.allowanceBase }, config())
    : getOwnerWithdrawInstructionAsync({ ...funds, amountBase: intent.amountBase }, config());
}

/** The owner's own writes, and the permissionless settle, through the session's queued lane. The desk's sends are the service's, never the wallet's. */
export function submitPrivateTx(ctx: WriteContext, intent: PrivateIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  return submitLaneWrite(ctx, intent.kind, () => instructionFor(ctx, intent), onPhase);
}
