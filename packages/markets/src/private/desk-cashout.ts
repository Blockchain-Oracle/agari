import { getDeskCreditFromPoolInstructionAsync, getDeskSweepSlotToPoolInstructionAsync } from "@agari/clients/agari-private";
import type { PrivateCashoutResult, PrivateClaim } from "@agari/core/private";
import { toMarketId, type Address, type Signature } from "@agari/core/types";
import { getOnchain } from "../provider/onchain";
import { verifyPrivateClaim } from "./claim";
import { keyBytes, kit, privateProgramId } from "./deployment";
import type { DeskClient } from "./desk-client";
import { readCredited, readDesk, readSlot } from "./reads";
import { settleSlotInstruction } from "./writes";

export class ClaimRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaimRefusedError";
  }
}

const config = () => ({ programAddress: kit(privateProgramId()) });

/**
 * The way home, presented the claim and nothing else: the owner is read out of the signed bytes, never off the
 * request. Settle (permissionless), sweep the slot to the pool, credit the pool to the owner, each step skipped when
 * the chain shows it landed, so a lost reply is answered by sending the same claim again.
 */
export async function cashOutPrivateBet(desk: DeskClient, claim: PrivateClaim, signature: Signature): Promise<PrivateCashoutResult> {
  const contract = await desk.contract();
  if (!contract) throw new ClaimRefusedError("There is no private desk on this network yet");
  return desk.withSlotLock(claim.slotId, async () => {
    const state = await readDesk();
    if (!state) throw new ClaimRefusedError("There is no private desk on this network yet");
    // The key the Desk account pins decides, not this process's opinion of itself.
    const pinned = state.data.desk as string as Address;
    if (!(await verifyPrivateClaim(claim, signature, pinned, contract, desk.chainId))) throw new ClaimRefusedError("this claim was not signed by the desk key the chain pins");
    let slot = await readSlot(claim.slotId);
    if (slot.fundedAtSec === 0) throw new ClaimRefusedError("no such slot on this desk");

    const txs: Partial<{ settle: Signature; sweep: Signature; credit: Signature }> = {};
    if (slot.quantityRaw > 0n && slot.marketId) {
      const onchain = await getOnchain(toMarketId(slot.marketId));
      if (!onchain.ok) throw new ClaimRefusedError(`could not read the Window: ${onchain.error.technical}`);
      if (!onchain.value.isResolved && !onchain.value.isVoided) return { status: "open", expirySec: slot.expirySec };
      txs.settle = (await desk.send("private settle", [await settleSlotInstruction(desk.signer, claim.slotId, toMarketId(slot.marketId), state.data.collateralMint)])) as Signature;
      slot = await readSlot(claim.slotId);
    }
    if (slot.balanceBase > 0n) {
      txs.sweep = (await desk.send("private sweep", [await getDeskSweepSlotToPoolInstructionAsync({ desk: desk.signer, slotId: keyBytes(claim.slotId) }, config())])) as Signature;
      slot = await readSlot(claim.slotId);
    }
    const credited = await readCredited(claim.owner, claim.creditKey);
    const owed = slot.sweptBase - credited;
    if (owed > 0n) {
      txs.credit = (await desk.send("private credit", [await getDeskCreditFromPoolInstructionAsync({ desk: desk.signer, owner: kit(claim.owner), amountBase: owed, creditKey: keyBytes(claim.creditKey) }, config())])) as Signature;
    }
    if (Object.keys(txs).length === 0) return { status: "done", creditedBase: credited.toString() };
    return { status: "credited", payoutBase: slot.payoutBase.toString(), creditedBase: (credited + (owed > 0n ? owed : 0n)).toString(), txs };
  });
}
