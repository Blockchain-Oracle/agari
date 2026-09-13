import { PRIVATE_NOT_DEPLOYED, type PrivateIntent } from "@masayume/core/private";
import type { IntentJournal, PhaseListener, TxOutcome } from "@masayume/core/ports";
import { diagnosis, type Address, type Diagnosis, type Hex } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import { erc20Abi, maxUint256, type ContractFunctionArgs, type ContractFunctionName } from "viem";
import { SOMNIA_SHANNON } from "../chain";
import { getCollateral } from "../collateral";
import { privateDeskAbi } from "../contracts/private-desk.abi";
import { checkGas, gasLimitFor } from "../submitter/gas";
import { getPrivateDeployment } from "../runtime/read-runtime";
import { awaitReceipt, settleVaultFailure, type Sent, type VaultContracts } from "../vault/write";
import { diagnosePrivate } from "./errors";

type DeskFn = ContractFunctionName<typeof privateDeskAbi, "nonpayable">;
type Args<F extends DeskFn> = ContractFunctionArgs<typeof privateDeskAbi, "nonpayable", F>;

export interface PrivateTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

function deskAddress(): Address {
  const deployment = getPrivateDeployment();
  if (!deployment) throw new Error(PRIVATE_NOT_DEPLOYED);
  return deployment.privateDesk;
}

function account(contracts: VaultContracts): Address {
  const acct = contracts.walletClient.account;
  if (!acct) throw new Error("the session's wallet client has no account bound");
  return acct.address as Address;
}

/** Simulate first — where viem decodes the desk's custom errors — then send, then wait for the receipt. */
export async function writePrivate<F extends DeskFn>(contracts: VaultContracts, functionName: F, args: Args<F>, label: string): Promise<Sent> {
  const address = deskAddress();
  const { request } = await contracts.publicClient.simulateContract({
    address,
    abi: privateDeskAbi,
    functionName,
    args,
    account: contracts.walletClient.account,
    chain: SOMNIA_SHANNON,
  } as never);
  const hash = await contracts.walletClient.writeContract({ ...(request as object), gas: gasLimitFor("private") } as never);
  return { hash, receipt: await awaitReceipt(contracts.publicClient, hash, label) };
}

/** The desk's first ERC-20 allowance is absorbed into the deposit that needs it (Approvals convention). */
export async function ensurePrivateAllowance(contracts: VaultContracts, amountBase: bigint): Promise<Hex | null> {
  const spender = deskAddress();
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

/** One intent, one contract call. A deposit absorbs its allowance first. */
export async function sendPrivateIntent(contracts: VaultContracts, intent: PrivateIntent): Promise<Sent> {
  switch (intent.kind) {
    case "private-deposit-and-allow":
      if (intent.amountBase > 0n) await ensurePrivateAllowance(contracts, intent.amountBase);
      return writePrivate(contracts, "depositAndAllow", [intent.amountBase, intent.allowanceBase], intent.kind);
    case "private-allow":
      return writePrivate(contracts, "allow", [intent.allowanceBase], intent.kind);
    case "private-revoke":
      return writePrivate(contracts, "revoke", [], intent.kind);
    case "private-withdraw":
      return writePrivate(contracts, "withdraw", [intent.amountBase], intent.kind);
    case "private-settle":
      return writePrivate(contracts, "settleSlot", [intent.slotId], intent.kind);
  }
}

/** The journal's one line, written for the person who reads it back after a timeout. */
export function summarizePrivate(intent: PrivateIntent, decimals: number): string {
  const amount = (base: bigint) => formatBaseUnits(base, decimals);
  switch (intent.kind) {
    case "private-deposit-and-allow":
      return `deposit ${amount(intent.amountBase)} into the private balance and allow the desk ${amount(intent.allowanceBase)}`;
    case "private-allow":
      return `allow the desk ${amount(intent.allowanceBase)} of the private balance`;
    case "private-revoke":
      return "revoke the desk's allowance on the private balance";
    case "private-withdraw":
      return `withdraw ${amount(intent.amountBase)} from the private balance`;
    case "private-settle":
      return `settle private slot ${intent.slotId} on ${intent.marketId}`;
  }
}

function refused(diag: Diagnosis): TxOutcome {
  return { status: "refused", diagnosis: diag };
}

/** The owner's lane against the desk: journal → gas → (allowance) → simulate → send → receipt. */
export async function submitPrivateTx(ctx: PrivateTxContext, intent: PrivateIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  const { wallet, contracts } = ctx;
  if (!contracts || !getPrivateDeployment()) return refused(diagnosis("not-deployed", PRIVATE_NOT_DEPLOYED));
  const record = await ctx.journal.record({ kind: intent.kind, wallet, summary: summarizePrivate(intent, getCollateral().decimals), ...("marketId" in intent ? { marketId: intent.marketId } : {}) });
  const gas = await checkGas(wallet, "private");
  if (!gas.ok) {
    await ctx.journal.markFailed(record.id, gas.diagnosis.technical);
    return refused(gas.diagnosis);
  }
  onPhase?.("submitted");
  try {
    const { hash } = await sendPrivateIntent(contracts, intent);
    await ctx.journal.markSent(record.id, hash);
    await ctx.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: hash });
    return { status: "confirmed", txHash: hash };
  } catch (error) {
    return settleVaultFailure(ctx.journal, record.id, error, onPhase, diagnosePrivate);
  }
}
