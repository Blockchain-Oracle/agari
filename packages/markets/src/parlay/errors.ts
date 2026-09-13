import type { Diagnosis, DiagnosisKind } from "@masayume/core/types";
import { diagnoseNamedRevert } from "../vault/errors";

/** The reserve's own reverts (`IParlayReserve` errors), mapped into the one diagnosis vocabulary (AD-13). */
const PARLAY_REVERT_KINDS: Record<string, DiagnosisKind> = {
  NotAdmin: "contract-revert",
  ZeroAddress: "contract-revert",
  ZeroAmount: "below-min-quantity",
  BadParams: "contract-revert",
  IsPaused: "contract-revert",
  BadLegCount: "contract-revert",
  DuplicateMarket: "contract-revert",
  UnknownMarket: "market-not-trading",
  WrongCollateral: "contract-revert",
  BadOutcome: "contract-revert",
  MarketNotTrading: "market-not-trading",
  LegExpired: "market-not-trading",
  ThinBook: "thin-book",
  LongShot: "outside-band",
  OverPayoutCap: "contract-revert",
  // The book moved between the quote and the open: the stake it now needs is above what was confirmed.
  StakeAboveMax: "requote",
  Underpriced: "outside-band",
  InsufficientLiquidity: "reserve-cap",
  OverExposure: "reserve-cap",
  OverExpiryCap: "reserve-cap",
  NoSuchParlay: "contract-revert",
  NoSuchLeg: "contract-revert",
  MarketNotSettled: "not-settled",
  NotWon: "contract-revert",
  InsufficientShares: "insufficient-collateral",
  ERC20InsufficientAllowance: "insufficient-allowance",
  ERC20InsufficientBalance: "insufficient-collateral",
};

export function diagnoseParlay(error: unknown): Diagnosis {
  return diagnoseNamedRevert(error, PARLAY_REVERT_KINDS);
}
