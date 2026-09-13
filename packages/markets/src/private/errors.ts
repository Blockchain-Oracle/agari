import type { Diagnosis, DiagnosisKind } from "@masayume/core/types";
import { diagnoseNamedRevert } from "../vault/errors";

/** The desk's own reverts (`IPrivateDesk` errors), mapped into the one diagnosis vocabulary (AD-13). */
const PRIVATE_REVERT_KINDS: Record<string, DiagnosisKind> = {
  NotAdmin: "contract-revert",
  NotDesk: "contract-revert",
  ZeroAddress: "contract-revert",
  ZeroAmount: "below-min-quantity",
  BadParams: "contract-revert",
  IsPaused: "contract-revert",
  Insufficient: "insufficient-collateral",
  OverAllowance: "insufficient-allowance",
  PoolShort: "contract-revert",
  KeyUsed: "contract-revert",
  SlotAlreadyFunded: "contract-revert",
  SlotNotFunded: "contract-revert",
  SlotAlreadyMinted: "already-claimed",
  SlotHoldsContracts: "not-settled",
  SlotEmpty: "already-claimed",
  StakeOutsideBand: "outside-band",
  UnknownMarket: "market-not-trading",
  WrongCollateral: "contract-revert",
  BadOutcome: "contract-revert",
  MarketNotTrading: "market-not-trading",
  TooLate: "market-not-trading",
  BelowMinQuantity: "requote",
  StakeAboveMax: "requote",
  NothingFilled: "no-liquidity",
  MarketNotSettled: "not-settled",
  NothingToSettle: "already-claimed",
  ImmediateOrCancelNoFill: "no-liquidity",
  ERC20InsufficientAllowance: "insufficient-allowance",
  ERC20InsufficientBalance: "insufficient-collateral",
};

export function diagnosePrivate(error: unknown): Diagnosis {
  return diagnoseNamedRevert(error, PRIVATE_REVERT_KINDS);
}
