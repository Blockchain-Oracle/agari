import type { Diagnosis, DiagnosisKind } from "@masayume/core/types";
import { diagnoseNamedRevert } from "../vault/errors";

/** The vault's own reverts (`IMarketMakerVault` errors), mapped into the one diagnosis vocabulary (AD-13). */
const MAKER_REVERT_KINDS: Record<string, DiagnosisKind> = {
  NotAdmin: "contract-revert",
  NotMaker: "contract-revert",
  ZeroAddress: "contract-revert",
  ZeroAmount: "below-min-quantity",
  BadParams: "contract-revert",
  IsPaused: "contract-revert",
  UnknownMarket: "market-not-trading",
  WrongCollateral: "contract-revert",
  MarketNotTrading: "market-not-trading",
  TooLate: "market-not-trading",
  BadExpiry: "order-expired",
  BadPrice: "outside-band",
  SpreadTooThin: "outside-band",
  OverQuantity: "contract-revert",
  OverWindowCap: "no-liquidity",
  OverExposure: "no-liquidity",
  TooManyWindows: "no-liquidity",
  InsufficientLiquidity: "no-liquidity",
  InsufficientShares: "insufficient-collateral",
  UnsettledWindow: "not-settled",
  MarketNotSettled: "not-settled",
  NothingToMerge: "contract-revert",
  NotQuoted: "contract-revert",
  OrderNotRested: "post-only-would-cross",
  PostOnlyWouldCross: "post-only-would-cross",
  ERC20InsufficientAllowance: "insufficient-allowance",
  ERC20InsufficientBalance: "insufficient-collateral",
};

export function diagnoseMaker(error: unknown): Diagnosis {
  return diagnoseNamedRevert(error, MAKER_REVERT_KINDS);
}
