import type { Diagnosis, DiagnosisKind } from "@masayume/core/types";
import { diagnoseNamedRevert } from "../vault/errors";

/** The reserve's own reverts (`ILeverageReserve` errors), mapped into the one diagnosis vocabulary (AD-13). */
const LEVERAGE_REVERT_KINDS: Record<string, DiagnosisKind> = {
  NotAdmin: "contract-revert",
  ZeroAddress: "contract-revert",
  ZeroAmount: "below-min-quantity",
  BadParams: "contract-revert",
  IsPaused: "contract-revert",
  UnknownMarket: "market-not-trading",
  WrongCollateral: "contract-revert",
  BadOutcome: "contract-revert",
  MarketNotTrading: "market-not-trading",
  TooLate: "market-not-trading",
  BadLeverage: "outside-band",
  ThinBook: "thin-book",
  OutsideBand: "outside-band",
  BelowMinQuantity: "below-min-quantity",
  StakeAboveMax: "requote",
  Underpriced: "outside-band",
  OverPositionCap: "reserve-cap",
  OverWindowCap: "reserve-cap",
  OverExposure: "reserve-cap",
  TooManyOpen: "reserve-cap",
  InsufficientLiquidity: "thin-book",
  InsufficientShares: "insufficient-collateral",
  NothingFilled: "thin-book",
  NoSuchPosition: "contract-revert",
  NotOwner: "contract-revert",
  NotLive: "already-claimed",
  StillHealthy: "contract-revert",
  Slippage: "requote",
  MarketNotSettled: "not-settled",
  UnsettledPosition: "not-settled",
  ImmediateOrCancelNoFill: "thin-book",
  ERC20InsufficientAllowance: "insufficient-allowance",
  ERC20InsufficientBalance: "insufficient-collateral",
};

export function diagnoseLeverage(error: unknown): Diagnosis {
  return diagnoseNamedRevert(error, LEVERAGE_REVERT_KINDS);
}
