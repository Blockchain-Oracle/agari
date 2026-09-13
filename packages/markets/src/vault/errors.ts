import { diagnosis, type Diagnosis, type DiagnosisKind } from "@masayume/core/types";
import { BaseError, ContractFunctionRevertedError } from "viem";
import { diagnoseWrite } from "../submitter/steps/assert-tx-ok";

/** The vault's own reverts (`IEventVault` errors), mapped into the one diagnosis vocabulary (AD-13). */
const VAULT_REVERT_KINDS: Record<string, DiagnosisKind> = {
  ZeroAmount: "below-min-quantity",
  Insufficient: "insufficient-collateral",
  UnknownMarket: "market-not-trading",
  WrongCollateral: "contract-revert",
  MarketNotTrading: "market-not-trading",
  MarketNotSettled: "not-settled",
  NothingToSettle: "already-claimed",
  BadOutcome: "contract-revert",
  NoSuchGrant: "grant-refused",
  NotGrantActor: "grant-refused",
  NotGrantOwner: "grant-refused",
  GrantIsRevoked: "grant-refused",
  GrantExpired: "grant-refused",
  BadExpiry: "grant-refused",
  ZeroActor: "grant-refused",
  OverStakeCap: "grant-refused",
  OverDailyCap: "grant-refused",
  OverPriceCap: "grant-refused",
  OverPositionCap: "grant-refused",
  NoDepositViaForwarder: "contract-revert",
  // The venue's own refusal of an IOC that crosses nothing, surfaced through the vault (verified on Shannon 2026-09-02).
  ImmediateOrCancelNoFill: "no-liquidity",
};

function revertedWith(error: unknown): ContractFunctionRevertedError | null {
  if (!(error instanceof BaseError)) return null;
  const found = error.walk((e) => e instanceof ContractFunctionRevertedError);
  return found instanceof ContractFunctionRevertedError ? found : null;
}

/** viem decodes the custom error from the ABI at simulation time; the name is what the table keys on. */
export function diagnoseNamedRevert(error: unknown, kinds: Record<string, DiagnosisKind>): Diagnosis {
  const reverted = revertedWith(error);
  const name = reverted?.data?.errorName;
  if (name) {
    const kind = kinds[name] ?? "contract-revert";
    const args = reverted?.data?.args?.map((a) => (typeof a === "bigint" ? a.toString() : String(a))).join(", ") ?? "";
    return diagnosis(kind, `${name}(${args})`, { errorName: name });
  }
  return diagnoseWrite(error);
}

export function diagnoseVault(error: unknown): Diagnosis {
  return diagnoseNamedRevert(error, VAULT_REVERT_KINDS);
}
