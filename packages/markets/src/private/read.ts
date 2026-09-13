import { PRIVATE_NOT_DEPLOYED, type PrivateBudget, type PrivateDeskState, type PrivateQuote, type PrivateSlot } from "@masayume/core/private";
import { err, ok, type Reading } from "@masayume/core/schemas";
import { diagnosis, OUTCOME_TO_SIDE, SIDE_TO_OUTCOME, toMarketId, type Address, type Bytes32, type MarketId, type OutcomeIdx, type Side } from "@masayume/core/types";
import type { PublicClient } from "viem";
import { MULTICALL3_ADDRESS } from "../chain";
import { getCollateral } from "../collateral";
import { privateDeskAbi } from "../contracts/private-desk.abi";
import { nowMs } from "../provider/clock";
import { withReading } from "../provider/reading";
import { getClient, getPrivateDeployment } from "../runtime/read-runtime";
import { diagnosePrivate } from "./errors";

const ZERO_MARKET = `0x${"00".repeat(32)}`;

type SlotTuple = {
  marketId: `0x${string}`;
  outcomeIdx: number;
  fundedAtSec: bigint;
  mintedAtSec: bigint;
  settledAtSec: bigint;
  expirySec: bigint;
  quantityRaw: bigint;
  balance: bigint;
  costRaw: bigint;
  payout: bigint;
  swept: bigint;
};

type PreviewTuple = { quantityRaw: bigint; costRaw: bigint; limitYesRaw: bigint; priceRaw: bigint };

/** The public `params` getter flattens the struct into a tuple, in declaration order. */
type ParamsTuple = readonly [bigint, bigint, number];

function viem(): PublicClient {
  return getClient().getViemClient() as PublicClient;
}

export function privateDeskContract() {
  const deployment = getPrivateDeployment();
  return deployment ? ({ address: deployment.privateDesk, abi: privateDeskAbi } as const) : null;
}

export function toPrivateSlot(slotId: Bytes32, s: SlotTuple): PrivateSlot {
  const minted = s.mintedAtSec !== 0n && s.marketId !== ZERO_MARKET;
  return {
    slotId,
    marketId: minted ? toMarketId(s.marketId) : null,
    side: minted ? OUTCOME_TO_SIDE[s.outcomeIdx as OutcomeIdx] : null,
    fundedAtSec: Number(s.fundedAtSec),
    mintedAtSec: Number(s.mintedAtSec),
    settledAtSec: Number(s.settledAtSec),
    expirySec: Number(s.expirySec),
    quantityRaw: s.quantityRaw,
    balanceBase: s.balance,
    costBase: s.costRaw,
    payoutBase: s.payout,
    sweptBase: s.swept,
  };
}

/** The desk's sheet, the pinned signer and its tunables in one multicall; null where no desk is deployed. */
export async function getPrivateDeskState(): Promise<Reading<PrivateDeskState | null>> {
  return withReading("privateDesk", async () => {
    const deployment = getPrivateDeployment();
    const contract = privateDeskContract();
    if (!deployment || !contract) return null;
    const [params, desk, paused, pool, owed, inSlots] = await viem().multicall({
      multicallAddress: MULTICALL3_ADDRESS,
      allowFailure: false,
      contracts: [
        { ...contract, functionName: "params" },
        { ...contract, functionName: "desk" },
        { ...contract, functionName: "paused" },
        { ...contract, functionName: "pool" },
        { ...contract, functionName: "owed" },
        { ...contract, functionName: "inSlots" },
      ],
    });
    const p = params as ParamsTuple;
    return {
      deployment,
      params: { minStakeBase: p[0], maxStakeBase: p[1], minTimeLeftSec: p[2] },
      desk: desk.toLowerCase() as Address,
      paused,
      poolBase: pool,
      owedBase: owed,
      inSlotsBase: inSlots,
      decimals: getCollateral().decimals,
    };
  });
}

export function toPrivateBudget(balanceBase: bigint, allowanceBase: bigint): PrivateBudget {
  return { balanceBase, allowanceBase, spendableBase: allowanceBase < balanceBase ? allowanceBase : balanceBase };
}

/** An owner's private balance and what the desk may spend of it; zeros (never an error) without a desk. */
export async function getPrivateBudget(owner: Address): Promise<Reading<PrivateBudget>> {
  return withReading(`privateBudget:${owner}`, async () => {
    const contract = privateDeskContract();
    if (!contract) return toPrivateBudget(0n, 0n);
    const [balance, allowance] = await viem().readContract({ ...contract, functionName: "budgetOf", args: [owner] });
    return toPrivateBudget(balance, allowance);
  });
}

export async function getPrivateSlot(slotId: Bytes32): Promise<Reading<PrivateSlot | null>> {
  return withReading(`privateSlot:${slotId}`, async () => {
    const contract = privateDeskContract();
    if (!contract) return null;
    const s = await viem().readContract({ ...contract, functionName: "slotOf", args: [slotId] });
    return toPrivateSlot(slotId, s as SlotTuple);
  });
}

/** The stake-first quote (`sizeForStake`): the size a stake affords off the live book, then that size priced. A refusal is the desk's reason, never a stale last-good. */
export async function sizePrivateForStake(marketId: MarketId, side: Side, stakeBase: bigint): Promise<Reading<PrivateQuote>> {
  const contract = privateDeskContract();
  if (!contract) return err(diagnosis("not-deployed", PRIVATE_NOT_DEPLOYED));
  try {
    const p = (await viem().readContract({ ...contract, functionName: "sizeForStake", args: [marketId as `0x${string}`, SIDE_TO_OUTCOME[side], stakeBase] })) as PreviewTuple;
    return ok({ side, stakeBase, quantityRaw: p.quantityRaw, costBase: p.costRaw, limitYesRaw: p.limitYesRaw, priceRaw: p.priceRaw, decimals: getCollateral().decimals, quotedAtMs: nowMs() }, nowMs());
  } catch (error) {
    return err(diagnosePrivate(error));
  }
}
