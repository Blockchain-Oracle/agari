import { LEVERAGE_NOT_DEPLOYED, type LeverageIntent } from "@masayume/core/leverage";
import type { IntentJournal, PhaseListener, TxOutcome } from "@masayume/core/ports";
import { diagnosis, SIDE_TO_OUTCOME, type Address, type Diagnosis, type Hex } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { erc20Abi, maxUint256, parseEventLogs, type ContractFunctionArgs, type ContractFunctionName } from "viem";
import { SOMNIA_SHANNON } from "../chain";
import { getCollateral } from "../collateral";
import { leverageReserveAbi } from "../contracts/leverage-reserve.abi";
import { checkGas, gasLimitFor } from "../submitter/gas";
import { getLeverageDeployment } from "../runtime/read-runtime";
import { awaitReceipt, settleVaultFailure, type Sent, type VaultContracts } from "../vault/write";
import { diagnoseLeverage } from "./errors";
import { sizeLeverageForStake } from "./read";

type ReserveFn = ContractFunctionName<typeof leverageReserveAbi, "nonpayable">;
type Args<F extends ReserveFn> = ContractFunctionArgs<typeof leverageReserveAbi, "nonpayable", F>;

export interface LeverageTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

export type LeverageOpenOutcome =
  | { status: "confirmed"; txHash: Hex; positionId: bigint; stakeBase: bigint; quantityRaw: bigint; frontedBase: bigint }
  /** The book moved: this stake now buys fewer contracts than the guard allows. Nothing was sent. */
  | { status: "requote"; stakeBase: bigint; quantityRaw: bigint }
  | { status: "refused"; diagnosis: Diagnosis }
  | { status: "reverted"; diagnosis: Diagnosis; txHash?: Hex }
  | { status: "unknown"; diagnosis: Diagnosis; txHash?: Hex };

function reserveAddress(): Address {
  const deployment = getLeverageDeployment();
  if (!deployment) throw new Error(LEVERAGE_NOT_DEPLOYED);
  return deployment.leverageReserve;
}

function account(contracts: VaultContracts): Address {
  const acct = contracts.walletClient.account;
  if (!acct) throw new Error("the session's wallet client has no account bound");
  return acct.address as Address;
}

/** Simulate first — where viem decodes the reserve's custom errors — then send, then wait for the receipt. */
export async function writeLeverage<F extends ReserveFn>(contracts: VaultContracts, functionName: F, args: Args<F>, label: string): Promise<Sent> {
  const address = reserveAddress();
  const { request } = await contracts.publicClient.simulateContract({
    address,
    abi: leverageReserveAbi,
    functionName,
    args,
    account: contracts.walletClient.account,
    chain: SOMNIA_SHANNON,
  } as never);
  const hash = await contracts.walletClient.writeContract({ ...(request as object), gas: gasLimitFor("leverage") } as never);
  return { hash, receipt: await awaitReceipt(contracts.publicClient, hash, label) };
}

/** The reserve's first ERC-20 allowance is absorbed into the open or supply that needs it (Approvals convention). */
export async function ensureLeverageAllowance(contracts: VaultContracts, amountBase: bigint): Promise<Hex | null> {
  const spender = reserveAddress();
  const owner = account(contracts);
  const token = getCollateral().address;
  const allowance = await contracts.publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, spender] });
  if (allowance >= amountBase) return null;
  const hash = await contracts.walletClient.writeContract({
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [spender, maxUint256],
    account: contracts.walletClient.account ?? owner,
    chain: SOMNIA_SHANNON,
    gas: gasLimitFor("approve"),
  });
  await awaitReceipt(contracts.publicClient, hash, "approve");
  return hash;
}

/** One intent, one contract call. Opens and supplies absorb their allowance first. */
export async function sendLeverageIntent(contracts: VaultContracts, intent: LeverageIntent): Promise<Sent> {
  switch (intent.kind) {
    case "leverage-open":
      await ensureLeverageAllowance(contracts, intent.stakeBase);
      return writeLeverage(contracts, "open", [intent.marketId as `0x${string}`, SIDE_TO_OUTCOME[intent.side], intent.stakeBase, intent.leverageBps, intent.minQuantityRaw], intent.kind);
    case "leverage-close":
      return writeLeverage(contracts, "close", [intent.positionId, intent.minProceedsBase], intent.kind);
    case "leverage-knock-out":
      return writeLeverage(contracts, "knockOut", [intent.positionId], intent.kind);
    case "leverage-settle":
      return writeLeverage(contracts, "settle", [intent.positionId], intent.kind);
    case "leverage-supply":
      await ensureLeverageAllowance(contracts, intent.amountBase);
      return writeLeverage(contracts, "supply", [intent.amountBase], intent.kind);
    case "leverage-withdraw":
      return writeLeverage(contracts, "withdraw", [intent.shares], intent.kind);
  }
}

/** The journal's one line, written for the person who reads it back after a timeout. */
export function summarizeLeverage(intent: LeverageIntent, decimals: number): string {
  const amount = (base: bigint) => formatBaseUnits(base, decimals);
  switch (intent.kind) {
    case "leverage-open":
      return `stake ${amount(intent.stakeBase)} ${intent.side} at ${intent.leverageBps / 10_000}x on ${intent.marketId}, at least ${intent.minQuantityRaw} contracts`;
    case "leverage-close":
      return `cash out boost #${intent.positionId} on ${intent.marketId} for at least ${amount(intent.minProceedsBase)}`;
    case "leverage-knock-out":
      return `knock out boost #${intent.positionId} on ${intent.marketId}`;
    case "leverage-settle":
      return `settle boost #${intent.positionId} on ${intent.marketId}`;
    case "leverage-supply":
      return `supply ${amount(intent.amountBase)} to the leverage reserve`;
    case "leverage-withdraw":
      return `redeem ${intent.shares} leverage reserve shares`;
  }
}

/** What the reserve booked is what its `Opened` event says: the id, the stake it actually charged, the size it got. */
export function bookLeverageOpen(sent: Sent): { positionId: bigint; stakeBase: bigint; quantityRaw: bigint; frontedBase: bigint } | null {
  const logs = parseEventLogs({ abi: leverageReserveAbi, eventName: "Opened", logs: sent.receipt.logs });
  const opened = logs[0];
  return opened ? { positionId: opened.args.positionId, stakeBase: opened.args.stake, quantityRaw: opened.args.quantityRaw, frontedBase: opened.args.fronted } : null;
}

function refused(diag: Diagnosis): TxOutcome {
  return { status: "refused", diagnosis: diag };
}

/** The reserve's lane: journal → gas → (allowance) → simulate → send → receipt. */
export async function submitLeverageTx(ctx: LeverageTxContext, intent: LeverageIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  const { wallet, contracts } = ctx;
  if (!contracts || !getLeverageDeployment()) return refused(diagnosis("not-deployed", LEVERAGE_NOT_DEPLOYED));
  const record = await ctx.journal.record({ kind: intent.kind, wallet, summary: summarizeLeverage(intent, getCollateral().decimals), ...("marketId" in intent ? { marketId: intent.marketId } : {}) });
  const gas = await checkGas(wallet, "leverage");
  if (!gas.ok) {
    await ctx.journal.markFailed(record.id, gas.diagnosis.technical);
    return refused(gas.diagnosis);
  }
  onPhase?.("submitted");
  try {
    const { hash } = await sendLeverageIntent(contracts, intent);
    await ctx.journal.markSent(record.id, hash);
    await ctx.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: hash });
    return { status: "confirmed", txHash: hash };
  } catch (error) {
    return settleVaultFailure(ctx.journal, record.id, error, onPhase, diagnoseLeverage);
  }
}

/**
 * The open, with what the Ticket needs back: the chain is asked once more what this stake buys before any
 * signature, and a size under the guard is surfaced as a requote instead of sent (the reserve would refuse
 * it as `BelowMinQuantity` anyway — this just spares the popup). The stake itself never changes.
 */
export async function submitLeverageOpen(ctx: LeverageTxContext, intent: Extract<LeverageIntent, { kind: "leverage-open" }>, maintenanceBps: number, onPhase?: PhaseListener): Promise<LeverageOpenOutcome> {
  if (!ctx.contracts || !getLeverageDeployment()) return { status: "refused", diagnosis: diagnosis("not-deployed", LEVERAGE_NOT_DEPLOYED) };
  const fresh = await sizeLeverageForStake(intent.marketId, intent.side, intent.stakeBase, intent.leverageBps, maintenanceBps);
  if (!fresh.ok) return { status: "refused", diagnosis: fresh.error };
  if (fresh.value.quantityRaw < intent.minQuantityRaw) return { status: "requote", stakeBase: intent.stakeBase, quantityRaw: fresh.value.quantityRaw };

  const record = await ctx.journal.record({ kind: intent.kind, wallet: ctx.wallet, summary: summarizeLeverage(intent, getCollateral().decimals), marketId: intent.marketId });
  const gas = await checkGas(ctx.wallet, "leverage");
  if (!gas.ok) {
    await ctx.journal.markFailed(record.id, gas.diagnosis.technical);
    return { status: "refused", diagnosis: gas.diagnosis };
  }
  onPhase?.("submitted");
  try {
    const sent = await sendLeverageIntent(ctx.contracts, intent);
    await ctx.journal.markSent(record.id, sent.hash);
    await ctx.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: sent.hash });
    const booked = bookLeverageOpen(sent);
    if (!booked) return { status: "unknown", diagnosis: diagnosis("unknown", "the open confirmed but emitted no Opened event"), txHash: sent.hash };
    return { status: "confirmed", txHash: sent.hash, ...booked };
  } catch (error) {
    const failure = await settleVaultFailure(ctx.journal, record.id, error, onPhase, diagnoseLeverage);
    if (failure.status === "confirmed") return { status: "unknown", diagnosis: diagnosis("unknown", "a failed send reported success"), txHash: failure.txHash };
    return failure;
  }
}
