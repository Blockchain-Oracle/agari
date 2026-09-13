import type { Diagnosis, DiagnosisKind } from "@masayume/core/types";
import { diagnoseNamedRevert } from "../vault/errors";

/** The reserve's own reverts (`IRangeReserve` errors), mapped into the one diagnosis vocabulary (AD-13). */
const RANGE_REVERT_KINDS: Record<string, DiagnosisKind> = {
  NotAdmin: "contract-revert",
  ZeroAddress: "contract-revert",
  ZeroAmount: "below-min-quantity",
  BadParams: "contract-revert",
  IsPaused: "contract-revert",
  UnknownMarket: "market-not-trading",
  WrongCollateral: "contract-revert",
  WrongVenue: "market-not-trading",
  WrongOracle: "market-not-trading",
  WrongAsset: "contract-revert",
  NoOpeningPrint: "not-settled",
  NoVolatility: "contract-revert",
  MarketNotTrading: "market-not-trading",
  TooLate: "market-not-trading",
  TooFar: "market-not-trading",
  BadBand: "outside-band",
  ThinBook: "thin-book",
  WideBook: "thin-book",
  WindowDecided: "outside-band",
  LongShot: "outside-band",
  NearCertain: "outside-band",
  OverPayoutCap: "contract-revert",
  // The basis moved between the quote and the open: the stake it now needs is above what was confirmed.
  StakeAboveMax: "requote",
  Underpriced: "outside-band",
  InsufficientLiquidity: "reserve-cap",
  OverExposure: "reserve-cap",
  OverExpiryCap: "reserve-cap",
  NoSuchRound: "contract-revert",
  NotSettled: "not-settled",
  NotStale: "not-settled",
  NotWon: "contract-revert",
  InsufficientShares: "insufficient-collateral",
  ERC20InsufficientAllowance: "insufficient-allowance",
  ERC20InsufficientBalance: "insufficient-collateral",
};

export function diagnoseRange(error: unknown): Diagnosis {
  return diagnoseNamedRevert(error, RANGE_REVERT_KINDS);
}
