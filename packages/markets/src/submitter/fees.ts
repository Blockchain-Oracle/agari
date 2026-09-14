import { FEE_RESERVE_LAMPORTS } from "@agari/core/constants";
import type { Address, Diagnosis } from "@agari/core/types";
import { notDeployed } from "../stub/not-deployed";

/** Which write is being funded; kept for the same call sites as Masayume's gas lanes (D-015). */
export type FeeLane = "order" | "faucet" | "redeem" | "vault" | "vault-order" | "parlay" | "range" | "maker" | "leverage" | "private" | "arena";

/**
 * Whether the signer can pay this write's network fee. Named `GasCheck` for its call sites; it is SOL in lamports.
 * A sponsored send (the `api/sponsor` fee-payer co-sign) needs no balance at all.
 */
export type GasCheck =
  | { ok: true; lane: FeeLane; balanceLamports: bigint; requiredLamports: bigint }
  | { ok: false; lane: FeeLane; balanceLamports: bigint | null; requiredLamports: bigint; diagnosis: Diagnosis };

/** Balance ≥ the fee reserve, checked before any signing (FR-2). Reading the balance needs the RPC client (S4). */
export async function checkGas(_wallet: Address, lane: FeeLane): Promise<GasCheck> {
  return { ok: false, lane, balanceLamports: null, requiredLamports: FEE_RESERVE_LAMPORTS, diagnosis: notDeployed() };
}
