import type { Address, Diagnosis, OnchainSnapshot, Quote } from "@agari/core/types";
import { notDeployed } from "../stub/not-deployed";

/**
 * Whether an order's escrow is covered. The engine draws the seat's credit first and the wallet's token account
 * second (credit-first funding, spec `events-engine.md` §4.1). There is no token approval on Solana.
 */
export type FundingCheck =
  | { ok: true; venueCreditUsedBase: bigint; walletSpendBase: bigint }
  | { ok: false; diagnosis: Diagnosis };

export async function assertFunded(_wallet: Address, _onchain: OnchainSnapshot, _quote: Quote): Promise<FundingCheck> {
  return { ok: false, diagnosis: notDeployed() };
}
