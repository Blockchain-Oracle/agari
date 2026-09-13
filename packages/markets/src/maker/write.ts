import { MAKER_NOT_DEPLOYED, type MakerIntent } from "@masayume/core/maker";
import type { IntentJournal, PhaseListener, TxOutcome } from "@masayume/core/ports";
import { diagnosis, type Address, type Diagnosis } from "@masayume/core/types";
import { formatBaseUnits } from "@masayume/core/units";
import type { GasLane } from "@masayume/core/constants";
import { erc20Abi, maxUint256, type ContractFunctionArgs, type ContractFunctionName, type Hex } from "viem";
import { SOMNIA_SHANNON } from "../chain";
import { getCollateral } from "../collateral";
import { marketMakerVaultAbi } from "../contracts/market-maker-vault.abi";
import { checkGas, gasLimitFor } from "../submitter/gas";
import { getMakerDeployment } from "../runtime/read-runtime";
import { awaitReceipt, settleVaultFailure, type Sent, type VaultContracts } from "../vault/write";
import { diagnoseMaker } from "./errors";

type VaultFn = ContractFunctionName<typeof marketMakerVaultAbi, "nonpayable">;
type Args<F extends VaultFn> = ContractFunctionArgs<typeof marketMakerVaultAbi, "nonpayable", F>;

export interface MakerTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

function vaultAddress(): Address {
  const deployment = getMakerDeployment();
  if (!deployment) throw new Error(MAKER_NOT_DEPLOYED);
  return deployment.marketMakerVault;
}

function account(contracts: VaultContracts): Address {
  const acct = contracts.walletClient.account;
  if (!acct) throw new Error("the session's wallet client has no account bound");
  return acct.address as Address;
}

/** Quotes and settlement do two venue calls or more; supply, withdraw and merge ride the vault lane. */
export function makerLaneOf(intent: MakerIntent): GasLane {
  return intent.kind === "maker-quote" || intent.kind === "maker-pull" || intent.kind === "maker-settle" ? "maker" : "vault";
}

/** Simulate first — where viem decodes the vault's custom errors — then send, then wait for the receipt. */
export async function writeMakerVault<F extends VaultFn>(contracts: VaultContracts, functionName: F, args: Args<F>, lane: GasLane, label: string): Promise<Sent> {
  const address = vaultAddress();
  const { request } = await contracts.publicClient.simulateContract({
    address,
    abi: marketMakerVaultAbi,
    functionName,
    args,
    account: contracts.walletClient.account,
    chain: SOMNIA_SHANNON,
  } as never);
  const hash = await contracts.walletClient.writeContract({ ...(request as object), gas: gasLimitFor(lane) } as never);
  return { hash, receipt: await awaitReceipt(contracts.publicClient, hash, label) };
}

/** The vault's first ERC-20 allowance is absorbed into the supply that needs it (Approvals convention). */
export async function ensureMakerAllowance(contracts: VaultContracts, amountBase: bigint): Promise<Hex | null> {
  const spender = vaultAddress();
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

/** One intent, one contract call. Supply absorbs its allowance first. */
export async function sendMakerIntent(contracts: VaultContracts, intent: MakerIntent): Promise<Sent> {
  const lane = makerLaneOf(intent);
  switch (intent.kind) {
    case "maker-supply":
      await ensureMakerAllowance(contracts, intent.amountBase);
      return writeMakerVault(contracts, "supply", [intent.amountBase], lane, intent.kind);
    case "maker-withdraw":
      return writeMakerVault(contracts, "withdraw", [intent.shares], lane, intent.kind);
    case "maker-quote":
      return writeMakerVault(contracts, "quote", [intent.marketId as `0x${string}`, intent.bidYesRaw, intent.askYesRaw, intent.quantityRaw, intent.expireNs], lane, intent.kind);
    case "maker-pull":
      return writeMakerVault(contracts, "pull", [intent.marketId as `0x${string}`], lane, intent.kind);
    case "maker-merge":
      return writeMakerVault(contracts, "merge", [intent.marketId as `0x${string}`], lane, intent.kind);
    case "maker-settle":
      return writeMakerVault(contracts, "settle", [intent.marketId as `0x${string}`], lane, intent.kind);
  }
}

/** The journal's one line, written for the person who reads it back after a timeout. */
export function summarizeMaker(intent: MakerIntent, decimals: number): string {
  const amount = (base: bigint) => formatBaseUnits(base, decimals);
  switch (intent.kind) {
    case "maker-supply":
      return `supply ${amount(intent.amountBase)} to the maker vault`;
    case "maker-withdraw":
      return `redeem ${intent.shares} maker vault shares`;
    case "maker-quote":
      return `quote ${intent.quantityRaw} a side at ${intent.bidYesRaw} / ${intent.askYesRaw} on ${intent.marketId}`;
    case "maker-pull":
      return `pull the vault's quotes on ${intent.marketId}`;
    case "maker-merge":
      return `merge the vault's complete sets on ${intent.marketId}`;
    case "maker-settle":
      return `settle the vault's Window ${intent.marketId}`;
  }
}

function refused(diag: Diagnosis): TxOutcome {
  return { status: "refused", diagnosis: diag };
}

/** The vault's lane: journal → gas → (allowance) → simulate → send → receipt. */
export async function submitMakerTx(ctx: MakerTxContext, intent: MakerIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  const { wallet, contracts } = ctx;
  if (!contracts || !getMakerDeployment()) return refused(diagnosis("not-deployed", MAKER_NOT_DEPLOYED));
  const record = await ctx.journal.record({ kind: intent.kind, wallet, summary: summarizeMaker(intent, getCollateral().decimals), ...("marketId" in intent ? { marketId: intent.marketId } : {}) });
  const gas = await checkGas(wallet, makerLaneOf(intent));
  if (!gas.ok) {
    await ctx.journal.markFailed(record.id, gas.diagnosis.technical);
    return refused(gas.diagnosis);
  }
  onPhase?.("submitted");
  try {
    const { hash } = await sendMakerIntent(contracts, intent);
    await ctx.journal.markSent(record.id, hash);
    await ctx.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: hash });
    return { status: "confirmed", txHash: hash };
  } catch (error) {
    return settleVaultFailure(ctx.journal, record.id, error, onPhase, diagnoseMaker);
  }
}
