import { diagnosis, type Diagnosis, type Hex } from "@masayume/core/types";
import type { TxResult } from "@somnia-chain/markets-sdk";
import { diagnose } from "../../errors/error-map";

/** Trader-tier writes resolve without inspecting the receipt; a reverted tx is never shown as success (FR-9). */
export class TxRevertedError extends Error {
  readonly txHash: Hex;

  constructor(label: string, txHash: Hex) {
    super(`${label} reverted on-chain (tx ${txHash})`);
    this.name = "TxRevertedError";
    this.txHash = txHash;
  }
}

export function assertTxOk<T extends TxResult>(result: T, label: string): T {
  if (result.receipt.status !== "success") throw new TxRevertedError(label, result.hash);
  return result;
}

/** Write-path diagnosis: a revert we detected ourselves carries its hash; everything else goes through the one error map (AD-13). */
export function diagnoseWrite(error: unknown): Diagnosis {
  if (error instanceof TxRevertedError) return diagnosis("contract-revert", error.message, { txHash: error.txHash });
  return diagnose(error);
}
