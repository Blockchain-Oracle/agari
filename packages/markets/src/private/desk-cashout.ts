import type { PrivateCashoutResult, PrivateClaim } from "@masayume/core/private";
import { toMarketId, type Address, type Hex } from "@masayume/core/types";
import { MULTICALL3_ADDRESS } from "../chain";
import { privateDeskAbi } from "../contracts/private-desk.abi";
import { getOnchain } from "../provider/onchain";
import { claimDomain, verifyPrivateClaim } from "./claim";
import type { DeskClient } from "./desk-client";
import { toPrivateSlot } from "./read";

async function readCashoutState(desk: DeskClient, contract: Address, claim: PrivateClaim) {
  const c = { address: contract, abi: privateDeskAbi } as const;
  const [pinned, slot, credited] = await desk.publicClient.multicall({
    multicallAddress: MULTICALL3_ADDRESS,
    allowFailure: false,
    contracts: [
      { ...c, functionName: "desk" },
      { ...c, functionName: "slotOf", args: [claim.slotId] },
      { ...c, functionName: "creditedOf", args: [claim.owner, claim.creditKey] },
    ],
  });
  return { pinned: pinned as Address, slot: toPrivateSlot(claim.slotId, slot as Parameters<typeof toPrivateSlot>[1]), credited };
}

export class ClaimRefusedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ClaimRefusedError";
  }
}

/**
 * The way home, presented the claim and nothing else: the owner is read out of the signed bytes, never off
 * the request. Settle (permissionless), sweep the slot to the pool, credit the pool to the owner — each step
 * skipped when the contract shows it landed, so a lost reply is answered by sending the same claim again.
 */
export async function cashOutPrivateBet(desk: DeskClient, claim: PrivateClaim, signature: Hex): Promise<PrivateCashoutResult> {
  const contract = desk.contract;
  if (!contract) throw new ClaimRefusedError("PrivateDesk is not deployed on this network yet");
  return desk.withSlotLock(claim.slotId, async () => {
    let state = await readCashoutState(desk, contract, claim);
    // The key the contract pins decides, not this process's opinion of itself.
    if (!(await verifyPrivateClaim(claimDomain(desk.chainId, contract), claim, signature, state.pinned))) {
      throw new ClaimRefusedError("this claim was not signed by the desk the contract pins");
    }
    if (state.slot.fundedAtSec === 0) throw new ClaimRefusedError("no such slot on this desk");

    const txs: Partial<{ settle: Hex; sweep: Hex; credit: Hex }> = {};
    if (state.slot.quantityRaw > 0n && state.slot.marketId) {
      const onchain = await getOnchain(toMarketId(state.slot.marketId));
      if (!onchain.ok) throw new ClaimRefusedError(`could not read the Window: ${onchain.error.technical}`);
      if (!onchain.value.isResolved && !onchain.value.isVoided) return { status: "open", expirySec: state.slot.expirySec };
      txs.settle = (await desk.send("settleSlot", [claim.slotId], "private settle")).hash;
      state = await readCashoutState(desk, contract, claim);
    }
    if (state.slot.balanceBase > 0n) {
      txs.sweep = (await desk.send("sweepSlotToPool", [claim.slotId], "private sweep")).hash;
      state = await readCashoutState(desk, contract, claim);
    }
    const owedCredit = state.slot.sweptBase - state.credited;
    if (owedCredit > 0n) {
      txs.credit = (await desk.send("creditFromPool", [claim.owner, owedCredit, claim.creditKey], "private credit")).hash;
    }
    const moved = Object.keys(txs).length > 0;
    if (!moved) return { status: "done", creditedBase: state.credited.toString() };
    return { status: "credited", payoutBase: state.slot.payoutBase.toString(), creditedBase: (state.credited + (owedCredit > 0n ? owedCredit : 0n)).toString(), txs };
  });
}
