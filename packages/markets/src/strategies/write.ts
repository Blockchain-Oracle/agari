import type { IntentJournal, PhaseListener, TxOutcome } from "@masayume/core/ports";
import { GAS_SAFETY_BPS } from "@masayume/core/constants";
import { encodeSpec, REGISTRY_NOT_DEPLOYED, type StrategyIntent } from "@masayume/core/strategies";
import { diagnosis, type Address, type Hex } from "@masayume/core/types";
import { formatBaseUnits, mulBpsCeil, oneUnit } from "@masayume/core/units";
import { erc20Abi, keccak256, toBytes, type ContractFunctionArgs, type ContractFunctionName } from "viem";
import { SOMNIA_SHANNON } from "../chain";
import { getCollateral } from "../collateral";
import { strategyRegistryAbi } from "../contracts/strategy-registry.abi";
import { ReadingError } from "../errors/reading-error";
import { checkGas } from "../submitter/gas";
import { TxRevertedError } from "../submitter/steps/assert-tx-ok";
import { awaitReceipt, settleVaultFailure, VaultBroadcastError, type Sent, type VaultBroadcastListener, type VaultContracts } from "../vault/write";
import { resolveRegistryDeployment } from "./deployment";

type RegistryFn = ContractFunctionName<typeof strategyRegistryAbi, "nonpayable">;
type Args<F extends RegistryFn> = ContractFunctionArgs<typeof strategyRegistryAbi, "nonpayable", F>;

export interface StrategyTxContext {
  journal: IntentJournal;
  wallet: Address;
  contracts: VaultContracts | undefined;
}

/** `keccak256` over the canonical spec encoding — what the registry pins as `specHash`. */
export function specHashOf(spec: Parameters<typeof encodeSpec>[0]): Hex {
  return keccak256(toBytes(encodeSpec(spec)));
}

function capsTuple(caps: { maxStakePerTradeBase: bigint; maxDailySpendBase: bigint; maxOpenPositions: number; maxPriceRaw: bigint }) {
  return { maxStakePerTrade: caps.maxStakePerTradeBase, maxDailySpend: caps.maxDailySpendBase, maxOpenPositions: caps.maxOpenPositions, maxPriceRaw: caps.maxPriceRaw };
}

/** Registry metadata has variable storage cost. Estimate the exact call with the shared 20% headroom. */
async function estimatedGas(contracts: VaultContracts, request: object): Promise<bigint> {
  const owner = contracts.walletClient.account?.address as Address | undefined;
  if (!owner) throw new Error("the session's wallet client has no account bound");
  const estimate = await contracts.publicClient.estimateContractGas(request as never);
  if (estimate <= 0n) throw new Error("The registry gas estimate is unavailable; nothing was sent.");
  const gas = mulBpsCeil(estimate, GAS_SAFETY_BPS);
  const balance = await checkGas(owner, "vault", gas);
  if (!balance.ok) {
    if (balance.diagnosis.kind !== "out-of-gas" || balance.balanceWei === null) throw new ReadingError(balance.diagnosis);
    const { decimals, symbol } = SOMNIA_SHANNON.nativeCurrency;
    const displayUnit = oneUnit(Math.max(0, decimals - 6));
    // Round the displayed minimum up, so following the refill instruction cannot underfund it.
    const minimum = ((balance.requiredWei + displayUnit - 1n) / displayUnit) * displayUnit;
    const available = formatBaseUnits(balance.balanceWei, decimals, { maxDp: 6, minDp: 0 });
    const required = formatBaseUnits(minimum, decimals, { maxDp: 6, minDp: 0 });
    const error = new ReadingError({ ...balance.diagnosis, technical: `Not enough ${symbol} for network gas. Your wallet has ${available} ${symbol}; this step needs at least ${required} ${symbol} available. Add ${symbol} from the Somnia testnet faucet, then retry.` });
    error.cause = new ReadingError(balance.diagnosis);
    throw error;
  }
  return gas;
}

/** Simulate first — where viem decodes the registry's custom errors — then estimate, sign and wait. */
export async function writeRegistry<F extends RegistryFn>(contracts: VaultContracts, functionName: F, args: Args<F>, label: string, onBroadcast?: VaultBroadcastListener): Promise<Sent> {
  const deployment = resolveRegistryDeployment();
  if (!deployment) throw new Error(REGISTRY_NOT_DEPLOYED);
  const { request } = await contracts.publicClient.simulateContract({
    address: deployment.strategyRegistry,
    abi: strategyRegistryAbi,
    functionName,
    args,
    account: contracts.walletClient.account,
    chain: SOMNIA_SHANNON,
  } as never);
  const gas = await estimatedGas(contracts, request as object);
  const hash = await contracts.walletClient.writeContract({ ...(request as object), gas } as never);
  try {
    await onBroadcast?.(hash);
    return { hash, receipt: await awaitReceipt(contracts.publicClient, hash, label) };
  } catch (error) {
    if (error instanceof TxRevertedError) throw error;
    throw new VaultBroadcastError(hash, error);
  }
}

/** Bound the registry to the reviewed fee, including zero. A fee increase during signing must revert. */
async function ensureFeeAllowance(contracts: VaultContracts, feeBase: bigint): Promise<void> {
  const deployment = resolveRegistryDeployment();
  const owner = contracts.walletClient.account?.address as Address | undefined;
  if (!deployment || !owner) throw new Error(REGISTRY_NOT_DEPLOYED);
  const token = getCollateral().address;
  const allowance = await contracts.publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, deployment.strategyRegistry] });
  if (allowance === feeBase) return;
  const request = {
    address: token,
    abi: erc20Abi,
    functionName: "approve",
    args: [deployment.strategyRegistry, feeBase],
    account: contracts.walletClient.account ?? owner,
    chain: SOMNIA_SHANNON,
  } as const;
  const gas = await estimatedGas(contracts, request);
  const hash = await contracts.walletClient.writeContract({ ...request, gas });
  await awaitReceipt(contracts.publicClient, hash, "approve");
  const updated = await contracts.publicClient.readContract({ address: token, abi: erc20Abi, functionName: "allowance", args: [owner, deployment.strategyRegistry] });
  if (updated !== feeBase) throw new Error("The registry allowance no longer matches the reviewed subscription fee. Check it before continuing.");
}

async function assertReviewedFee(contracts: VaultContracts, strategyId: bigint, feeBase: bigint): Promise<void> {
  const deployment = resolveRegistryDeployment();
  if (!deployment) throw new Error(REGISTRY_NOT_DEPLOYED);
  const strategy = await contracts.publicClient.readContract({ address: deployment.strategyRegistry, abi: strategyRegistryAbi, functionName: "strategyOf", args: [strategyId] });
  if (!strategy.active || strategy.subscriptionFee !== feeBase) throw new Error("The subscription fee or strategy status changed. Review it before another signature.");
}

export async function sendStrategyIntent(contracts: VaultContracts, intent: StrategyIntent, onBroadcast?: VaultBroadcastListener): Promise<Sent> {
  switch (intent.kind) {
    case "strategy-publish":
      return writeRegistry(contracts, "publish", [intent.runner, specHashOf(intent.spec), JSON.stringify(intent.metadata), capsTuple(intent.envelope), intent.feeBase], intent.kind, onBroadcast);
    case "strategy-update":
      return writeRegistry(contracts, "update", [intent.strategyId, specHashOf(intent.spec), JSON.stringify(intent.metadata), intent.feeBase], intent.kind, onBroadcast);
    case "strategy-subscribe":
      await assertReviewedFee(contracts, intent.strategyId, intent.feeBase);
      await ensureFeeAllowance(contracts, intent.feeBase);
      await assertReviewedFee(contracts, intent.strategyId, intent.feeBase);
      return writeRegistry(contracts, "subscribe", [intent.strategyId, intent.grantId], intent.kind, onBroadcast);
    case "strategy-unsubscribe":
      return writeRegistry(contracts, "unsubscribe", [intent.strategyId], intent.kind, onBroadcast);
    case "strategy-deactivate":
      return writeRegistry(contracts, "deactivate", [intent.strategyId], intent.kind, onBroadcast);
  }
}

export function summarizeStrategy(intent: StrategyIntent, decimals: number): string {
  switch (intent.kind) {
    case "strategy-publish":
      return `publish strategy "${intent.metadata.name}" run by ${intent.runner}`;
    case "strategy-update":
      return `update strategy #${intent.strategyId}`;
    case "strategy-subscribe":
      return `subscribe to strategy #${intent.strategyId} with grant #${intent.grantId}${intent.feeBase > 0n ? ` (fee ${formatBaseUnits(intent.feeBase, decimals)})` : ""}`;
    case "strategy-unsubscribe":
      return `unsubscribe from strategy #${intent.strategyId}`;
    case "strategy-deactivate":
      return `deactivate strategy #${intent.strategyId}`;
  }
}

/**
 * The second lane for the registry: journal → gas → (fee allowance) → simulate → send → receipt.
 * Journaled under its own kinds; the intent union in `@masayume/core/ports` grows to include them
 * when the parent wires `StrategyIntent` in — until then the record is cast, never faked.
 */
export async function submitStrategyTx(ctx: StrategyTxContext, intent: StrategyIntent, onPhase?: PhaseListener): Promise<TxOutcome> {
  const { wallet, contracts } = ctx;
  if (!contracts || !resolveRegistryDeployment()) return { status: "refused", diagnosis: diagnosis("not-deployed", REGISTRY_NOT_DEPLOYED) };
  const record = await ctx.journal.record({ kind: intent.kind, wallet, summary: summarizeStrategy(intent, getCollateral().decimals) });
  onPhase?.("submitted");
  let broadcastHash: Hex | undefined;
  try {
    const { hash } = await sendStrategyIntent(contracts, intent, async (hash) => {
      broadcastHash = hash;
      await ctx.journal.markSent(record.id, hash);
    });
    await ctx.journal.markConfirmed(record.id);
    onPhase?.("confirmed", { txHash: hash });
    return { status: "confirmed", txHash: hash };
  } catch (error) {
    return settleVaultFailure(ctx.journal, record.id, error, onPhase, undefined, broadcastHash);
  }
}
