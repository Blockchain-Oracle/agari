import type { XReceipt } from "@masayume/core/x";
import { priceRawToBps, oneUnit } from "@masayume/core/units";
import { toMarketId, type Address, type Hex } from "@masayume/core/types";
import { recoverVaultExecution, type RecoveredVaultExecution } from "@masayume/markets/vault";

/** Only complete durable execution context can be reconciled against the shared vault verifier. */
export async function resolveXExecution(receipt: XReceipt): Promise<RecoveredVaultExecution> {
  const address = /^0x[0-9a-fA-F]{40}$/;
  if (!receipt.wallet || !address.test(receipt.wallet) || !receipt.executionActor || !address.test(receipt.executionActor)
    || !receipt.marketId || !/^0x[0-9a-fA-F]{64}$/.test(receipt.marketId) || !receipt.grantId || !/^\d{1,78}$/.test(receipt.grantId)
    || (receipt.side !== "up" && receipt.side !== "down")) return { status: "unknown" };
  if (!receipt.txHash && !receipt.intentRecordedAtMs) return { status: "unknown" };
  if (receipt.txHash && !/^0x[0-9a-fA-F]{64}$/.test(receipt.txHash)) return { status: "unknown" };
  return recoverVaultExecution({ owner: receipt.wallet as Address, actor: receipt.executionActor as Address,
    marketId: toMarketId(receipt.marketId), grantId: BigInt(receipt.grantId), side: receipt.side,
    fromBlock: receipt.recoveryFromBlock && /^\d{1,78}$/.test(receipt.recoveryFromBlock) ? BigInt(receipt.recoveryFromBlock) : 0n,
    txHash: receipt.txHash as Hex | null, expectedNonce: receipt.expectedNonce });
}

/** A confirmed vault call can still book zero tokens. Amounts come only from the verified event. */
export function recoverExecutionReceipt(receipt: XReceipt, result: RecoveredVaultExecution): XReceipt {
  const unknown = { ...receipt, status: "unknown" as const, reason: "Execution needs checking before another instruction." };
  if (result.status === "unknown") return unknown;
  if (result.status === "reverted") return { ...receipt, status: "reverted", txHash: result.txHash, reason: "The trade reverted on-chain." };
  if (result.tokenDelta === 0n) return { ...receipt, status: "nothing-filled", txHash: result.txHash, reason: "No position was booked." };
  const decimals = receipt.collateralDecimals;
  if (typeof decimals !== "number" || !Number.isInteger(decimals) || decimals < 0 || decimals > 18) return { ...unknown, txHash: result.txHash };
  return { ...receipt, status: "filled", txHash: result.txHash, reason: null, bookedCostBase: result.cashDelta.toString(),
    bookedContractsRaw: result.tokenDelta.toString(), avgPriceBps: priceRawToBps((result.cashDelta * oneUnit(decimals)) / result.tokenDelta, decimals) };
}

export interface XRecoveryContext {
  candidates(): Promise<XReceipt[]>;
  resolve(receipt: XReceipt): Promise<RecoveredVaultExecution>;
  save(before: XReceipt, after: XReceipt): Promise<boolean>;
  log(message: string): void;
}

/** Recovery has no signer, submitter, trade replay or public repost path. */
export async function recoverXExecutions(ctx: XRecoveryContext): Promise<void> {
  for (const receipt of await ctx.candidates()) {
    let result: RecoveredVaultExecution = { status: "unknown" };
    try { result = await ctx.resolve(receipt); }
    catch { /* Missing receipt or a provider outage remains unknown. */ }
    const next = recoverExecutionReceipt(receipt, result);
    if (await ctx.save(receipt, next)) ctx.log(`mention ${receipt.mentionId}: recovered ${next.status}; no execution replay`);
  }
}
