import { GAS_CEILING, GAS_SAFETY_BPS, SDK_MAX_FEE_PER_GAS_WEI, type GasLane } from "@masayume/core/constants";
import { diagnosis, type Address, type Diagnosis } from "@masayume/core/types";
import { mulBpsCeil } from "@masayume/core/units";
import { diagnose } from "../errors/error-map";
import { getClient } from "../runtime/read-runtime";

export type GasCheck =
  | { ok: true; lane: GasLane; balanceWei: bigint; requiredWei: bigint }
  | { ok: false; lane: GasLane; balanceWei: bigint | null; requiredWei: bigint; diagnosis: Diagnosis };

export function gasLimitFor(lane: GasLane): bigint {
  return GAS_CEILING[lane];
}

/** The whole ceiling must be funded on top of `value`, or Somnia rejects the tx with a misleading "invalid parameters". */
export function gasEnvelopeWei(lane: GasLane): bigint {
  return GAS_CEILING[lane] * SDK_MAX_FEE_PER_GAS_WEI;
}

export function requiredGasWei(lane: GasLane, gasLimit = GAS_CEILING[lane]): bigint {
  return mulBpsCeil(gasLimit * SDK_MAX_FEE_PER_GAS_WEI, GAS_SAFETY_BPS);
}

/** Sufficiency is balance ≥ envelope × safety factor — never merely nonzero — and it is checked before any signing (FR-2). */
export async function checkGas(wallet: Address, lane: GasLane, gasLimit?: bigint): Promise<GasCheck> {
  const requiredWei = requiredGasWei(lane, gasLimit);
  let balanceWei: bigint;
  try {
    balanceWei = await getClient().getNativeBalance(wallet);
  } catch (error) {
    return { ok: false, lane, balanceWei: null, requiredWei, diagnosis: diagnose(error) };
  }
  if (balanceWei >= requiredWei) return { ok: true, lane, balanceWei, requiredWei };
  return {
    ok: false,
    lane,
    balanceWei,
    requiredWei,
    diagnosis: diagnosis("out-of-gas", `native balance ${balanceWei} wei is below the ${requiredWei} wei ${lane} envelope`),
  };
}
