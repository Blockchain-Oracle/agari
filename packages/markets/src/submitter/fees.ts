import { FEE_RESERVE_LAMPORTS } from "@agari/core/constants";
import { diagnosis, type Address, type Diagnosis } from "@agari/core/types";
import type { Address as KitAddress } from "@solana/kit";
import { diagnose } from "../errors/error-map";
import type { WriteRpc } from "./steps/message";

/** Which write is being funded; kept for the same call sites as Masayume's gas lanes (D-015). */
export type FeeLane = "order" | "faucet" | "redeem" | "vault" | "vault-order" | "parlay" | "range" | "maker" | "leverage" | "private" | "arena";

/**
 * Whether the signer can pay this write's network fee. Named `GasCheck` for its call sites; it is SOL in lamports.
 * A sponsored send (the `api/sponsor` fee-payer co-sign, S7) needs no balance at all.
 */
export type GasCheck =
  | { ok: true; lane: FeeLane; balanceLamports: bigint; requiredLamports: bigint }
  | { ok: false; lane: FeeLane; balanceLamports: bigint | null; requiredLamports: bigint; diagnosis: Diagnosis };

/** Rent-exempt minimum of a 165-byte SPL token account: what a transaction that creates the wallet's ATA also costs. */
export const TOKEN_ACCOUNT_RENT_LAMPORTS = 2_039_280n;

/**
 * Balance ≥ the fee reserve (plus an ATA's rent when this write creates one), checked before any signing (FR-2,
 * first-call.md §3.3). The wallet pays its own fee (D-023).
 */
export async function checkGas(rpc: WriteRpc, wallet: Address, lane: FeeLane, extraLamports = 0n): Promise<GasCheck> {
  const requiredLamports = FEE_RESERVE_LAMPORTS + extraLamports;
  let balanceLamports: bigint;
  try {
    balanceLamports = (await rpc.getBalance(wallet as string as KitAddress, { commitment: "confirmed" }).send()).value;
  } catch (error) {
    return { ok: false, lane, balanceLamports: null, requiredLamports, diagnosis: diagnose(error) };
  }
  if (balanceLamports >= requiredLamports) return { ok: true, lane, balanceLamports, requiredLamports };
  return {
    ok: false,
    lane,
    balanceLamports,
    requiredLamports,
    diagnosis: diagnosis("out-of-gas", `SOL balance ${balanceLamports} lamports is below the ${requiredLamports} lamports the ${lane} write needs`),
  };
}
