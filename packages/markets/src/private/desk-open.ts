import { privateAuthFresh, type PrivateClaim, type PrivateOpenResult, type PrivateTicket } from "@masayume/core/private";
import { SIDE_TO_OUTCOME, type Address, type Hex, type MarketId, type Side } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { MULTICALL3_ADDRESS } from "../chain";
import { getCollateral } from "../collateral";
import { privateDeskAbi } from "../contracts/private-desk.abi";
import { isTimeoutError } from "../submitter/failure";
import { requiredGasWei } from "../submitter/gas";
import { claimDomain, signPrivateClaim } from "./claim";
import type { DeskClient } from "./desk-client";
import { diagnosePrivate } from "./errors";
import { deriveSlotKeys } from "./keys";
import { toPrivateSlot } from "./read";

export interface DeskOpenInput {
  owner: Address;
  marketId: MarketId;
  side: Side;
  stakeBase: bigint;
  minQuantityRaw: bigint;
  authSignature: Hex;
  /** When the owner signed. A charge needs a fresh one; a resume of a charge that already landed does not. */
  issuedAtMs: number;
  asset: string;
  intervalSec: number;
  expirySec: number;
}

/** Everything the resume needs, read in one multicall off the contract — the desk keeps no record of its own. */
/** An open is three sends; the desk must be able to pay for all of them before it starts one. */
const OPEN_SENDS = 3n;

/** The first line only: viem's messages carry the RPC URL and the request body under it, which anonymous callers never see. */
export function publicReason(technical: string): string {
  return technical.split("\n")[0]?.trim() || "the desk could not complete this";
}

async function readOpenState(desk: DeskClient, contract: Address, owner: Address, chargeKey: Hex, slotId: Hex) {
  const c = { address: contract, abi: privateDeskAbi } as const;
  const [charged, slot, budget, paused, credited] = await desk.publicClient.multicall({
    multicallAddress: MULTICALL3_ADDRESS,
    allowFailure: false,
    contracts: [
      { ...c, functionName: "chargedOf", args: [owner, chargeKey] },
      { ...c, functionName: "slotOf", args: [slotId] },
      { ...c, functionName: "budgetOf", args: [owner] },
      { ...c, functionName: "paused" },
      { ...c, functionName: "creditedOf", args: [owner, deriveSlotKeys(chargeKey).creditKey] },
    ],
  });
  return { charged, slot: toPrivateSlot(slotId, slot as Parameters<typeof toPrivateSlot>[1]), balance: budget[0], allowance: budget[1], paused, credited };
}

/**
 * The desk's open, as a state machine over chain state rather than a record: charge → fund → mint, each
 * step skipped when the contract already shows it landed. The three keys come from the owner's own
 * authorisation signature, so a request that lost its reply can simply be sent again — and a mint the book
 * refuses is refunded to the private balance on the spot, with the reason.
 */
export async function openPrivateBet(desk: DeskClient, input: DeskOpenInput): Promise<PrivateOpenResult> {
  const contract = desk.contract;
  if (!contract) return { status: "unknown", reason: "PrivateDesk is not deployed on this network yet", txs: {} };
  const keys = deriveSlotKeys(input.authSignature);
  const { owner, stakeBase } = input;
  const decimals = getCollateral().decimals;
  const symbol = getCollateral().symbol;
  const amount = (base: bigint) => `${formatBaseUnits(base, decimals)} ${symbol}`;

  return desk.withSlotLock(keys.slotId, async () => {
    const txs: Partial<{ charge: Hex; fund: Hex; mint: Hex; sweep: Hex; credit: Hex }> = {};
    let state = await readOpenState(desk, contract, owner, keys.chargeKey, keys.slotId);
    try {
      if (state.charged === 0n) {
        // Freshness gates only a NEW charge: an authorisation whose charge already landed is resumed however old it is,
        // because refusing it would strand the money it already moved.
        if (!privateAuthFresh(input.issuedAtMs, Date.now())) return { status: "refused", reason: "That authorisation has expired — confirm again.", technical: "auth expired", refundedBase: "0", txs };
        if (state.paused) return { status: "refused", reason: "Private mode is paused right now.", technical: "IsPaused()", refundedBase: "0", txs };
        if (state.balance < stakeBase) return { status: "refused", reason: `Your private balance is ${amount(state.balance)}; this bet needs ${amount(stakeBase)}.`, technical: "Insufficient", refundedBase: "0", txs };
        if (state.allowance < stakeBase) return { status: "refused", reason: `Your private spending limit has ${amount(state.allowance)} left; this bet needs ${amount(stakeBase)}.`, technical: "OverAllowance", refundedBase: "0", txs };
        // Before a cent moves: the book must be able to fill this at the owner's guard (a refused mint would cost the
        // desk four sends and the owner nothing), and the desk must be able to pay for the whole open.
        try {
          const preview = (await desk.publicClient.readContract({ address: contract, abi: privateDeskAbi, functionName: "sizeForStake", args: [input.marketId as `0x${string}`, SIDE_TO_OUTCOME[input.side], stakeBase] })) as { quantityRaw: bigint };
          if (preview.quantityRaw < input.minQuantityRaw) return { status: "refused", reason: refusalWords("requote"), technical: `sizeForStake ${preview.quantityRaw} < guard ${input.minQuantityRaw}`, refundedBase: "0", txs };
        } catch (error) {
          const diag = diagnosePrivate(error);
          return { status: "refused", reason: refusalWords(diag.kind), technical: publicReason(diag.technical), refundedBase: "0", txs };
        }
        if ((await desk.publicClient.getBalance({ address: desk.address })) < requiredGasWei("private") * OPEN_SENDS) {
          return { status: "refused", reason: "Private mode is short of gas right now; nothing was charged.", technical: "desk STT below the open's envelope", refundedBase: "0", txs };
        }
        txs.charge = (await desk.send("chargeToPool", [owner, stakeBase, keys.chargeKey], "private charge")).hash;
        state.charged = stakeBase;
      }
      if (state.slot.fundedAtSec === 0) {
        txs.fund = (await desk.send("fundSlot", [keys.slotId, state.charged], "private fund")).hash;
      } else if (state.slot.mintedAtSec === 0 && state.slot.balanceBase === 0n) {
        // Funded once, then swept back: this authorisation was already refused. Finish the refund if its credit was
        // the send that got lost — otherwise the stake would sit in the pool with no ticket to claim it.
        const owedCredit = state.slot.sweptBase - state.credited;
        if (owedCredit > 0n) txs.credit = (await desk.send("creditFromPool", [owner, owedCredit, keys.creditKey], "private refund credit")).hash;
        return { status: "refused", reason: "This bet was already refunded to your private balance.", technical: "slot swept", refundedBase: state.slot.sweptBase.toString(), txs };
      }
      if (state.slot.mintedAtSec === 0) {
        try {
          txs.mint = (await desk.send("mintInSlot", [keys.slotId, input.marketId as `0x${string}`, SIDE_TO_OUTCOME[input.side], input.minQuantityRaw], "private mint")).hash;
        } catch (error) {
          if (isTimeoutError(error)) throw error;
          // The book refused: the whole stake goes straight back, the reason with it.
          const diag = diagnosePrivate(error);
          txs.sweep = (await desk.send("sweepSlotToPool", [keys.slotId], "private refund sweep")).hash;
          txs.credit = (await desk.send("creditFromPool", [owner, state.charged, keys.creditKey], "private refund credit")).hash;
          return { status: "refused", reason: refusalWords(diag.kind), technical: publicReason(diag.technical), refundedBase: state.charged.toString(), txs };
        }
      }
      state = await readOpenState(desk, contract, owner, keys.chargeKey, keys.slotId);
      const claim: PrivateClaim = {
        owner,
        slotId: keys.slotId,
        creditKey: keys.creditKey,
        marketId: input.marketId,
        outcomeIdx: SIDE_TO_OUTCOME[input.side],
        stakeBase: state.charged.toString(),
        issuedAtMs: Date.now(),
      };
      const signature = await signPrivateClaim(desk.walletClient, claimDomain(desk.chainId, contract), claim);
      const ticket: PrivateTicket = {
        claim,
        signature,
        desk: desk.address,
        contract,
        chainId: desk.chainId,
        asset: input.asset,
        intervalSec: input.intervalSec,
        expirySec: input.expirySec,
        quantityRaw: state.slot.quantityRaw.toString(),
        costBase: state.slot.costBase.toString(),
        txs: { charge: txs.charge ?? "0x", fund: txs.fund ?? "0x", mint: txs.mint ?? "0x" },
        openedAtMs: claim.issuedAtMs,
        status: "open",
      };
      return { status: "opened", ticket };
    } catch (error) {
      if (isTimeoutError(error)) return { status: "unknown", reason: "The chain has not answered yet. Try again in a moment — nothing is charged twice.", txs };
      const diag = diagnosePrivate(error);
      return { status: "unknown", reason: publicReason(diag.technical), txs };
    }
  });
}

function refusalWords(kind: string): string {
  switch (kind) {
    case "requote":
      return "The book moved under your quote. Your stake is back in your private balance — quote again.";
    case "no-liquidity":
      return "Nobody is on the other side at this size right now. Your stake is back in your private balance.";
    case "market-not-trading":
      return "That Window is no longer taking entries. Your stake is back in your private balance.";
    case "outside-band":
      return "That stake is outside what private bets allow. Your stake is back in your private balance.";
    default:
      return "The desk could not place this bet. Your stake is back in your private balance.";
  }
}
