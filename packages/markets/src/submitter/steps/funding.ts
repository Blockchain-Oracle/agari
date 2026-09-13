import { diagnosis, type Address, type Diagnosis, type OnchainSnapshot, type Quote } from "@masayume/core/types";
import { diagnose } from "../../errors/error-map";
import { getClient } from "../../runtime/read-runtime";
import { checkGas } from "../gas";

export type FundingCheck =
  | {
      ok: true;
      /** True when the pool's allowance is short: the SDK absorbs the approval into this action, which means two wallet signatures. */
      needsApproval: boolean;
      venueCreditUsedBase: bigint;
      walletSpendBase: bigint;
      allowanceBase: bigint;
    }
  | { ok: false; diagnosis: Diagnosis };

/** Escrow is drawn from the venue's per-pool payout credit first and the wallet second (FR-5); the pool holds escrow, so its allowance is what an approval covers. */
export async function assertFunded(wallet: Address, onchain: OnchainSnapshot, quote: Quote): Promise<FundingCheck> {
  const client = getClient();
  try {
    const [balanceBase, creditBase, allowanceBase, gas] = await Promise.all([
      client.getErc20Balance(onchain.collateral, wallet),
      client.getVaultBalance({ vault: onchain.pool, owner: wallet, token: onchain.collateral }),
      client.getErc20Allowance(onchain.collateral, wallet, onchain.pool),
      checkGas(wallet, "order"),
    ]);
    if (!gas.ok) return { ok: false, diagnosis: gas.diagnosis };

    const venueCreditUsedBase = creditBase < quote.maxCostBase ? creditBase : quote.maxCostBase;
    const walletSpendBase = quote.maxCostBase - venueCreditUsedBase;
    if (balanceBase < walletSpendBase) {
      return {
        ok: false,
        diagnosis: diagnosis("insufficient-collateral", `wallet holds ${balanceBase} but the order escrows ${walletSpendBase} after venue credit`),
      };
    }
    return { ok: true, needsApproval: allowanceBase < walletSpendBase, venueCreditUsedBase, walletSpendBase, allowanceBase };
  } catch (error) {
    return { ok: false, diagnosis: diagnose(error) };
  }
}
