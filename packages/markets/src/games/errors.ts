import type { Diagnosis, DiagnosisKind } from "@masayume/core/types";
import { diagnoseNamedRevert } from "../vault/errors";

/**
 * The arena's own reverts (`IGameArena` errors), mapped into the one diagnosis vocabulary (AD-13).
 *
 * The lifecycle refusals deliberately land on `contract-revert` rather than something friendlier: a
 * duel surface must say what actually happened — "this card is already played", "the deadline passed" —
 * from the decoded error name, not from a generic bucket. The kinds here are only what the shared
 * recovery UI branches on.
 */
const ARENA_REVERT_KINDS: Record<string, DiagnosisKind> = {
  NotAdmin: "contract-revert",
  ZeroAddress: "contract-revert",
  ZeroAmount: "below-min-quantity",
  BadParams: "contract-revert",
  IsPaused: "contract-revert",
  UnknownMarket: "market-not-trading",
  WrongCollateral: "contract-revert",
  WrongVenue: "market-not-trading",
  BadOutcome: "contract-revert",
  MarketNotTrading: "market-not-trading",
  MarketNotSettled: "not-settled",
  TooLate: "market-not-trading",
  BelowMinQuantity: "below-min-quantity",
  // The book moved between the walk and the fill: what it cost is above the cap this card was given.
  CostAboveStake: "requote",
  StakeAboveCap: "outside-band",
  MatchExists: "contract-revert",
  NoSuchMatch: "contract-revert",
  WrongStatus: "contract-revert",
  UnknownTier: "contract-revert",
  BadDeckSize: "contract-revert",
  DuplicateCard: "contract-revert",
  DeckMismatch: "contract-revert",
  NotAPlayer: "contract-revert",
  SelfJoin: "contract-revert",
  DeadlinePassed: "contract-revert",
  DeadlineNotPassed: "contract-revert",
  BadCard: "contract-revert",
  AlreadyPicked: "contract-revert",
  NotPicked: "contract-revert",
  AlreadySettled: "contract-revert",
  CardsOutstanding: "not-settled",
  NoCredit: "contract-revert",
  Overflow: "contract-revert",
  // The agent lane: a key that is not the seat's, has run out, or would overstep the deck's ceiling.
  NotAgent: "signer-required",
  AgentExpired: "signer-required",
  AgentOverBudget: "contract-revert",
  BadTtl: "contract-revert",
  AgentUnfunded: "contract-revert",
  ERC20InsufficientAllowance: "insufficient-allowance",
  ERC20InsufficientBalance: "insufficient-collateral",
};

export function diagnoseArena(error: unknown): Diagnosis {
  return diagnoseNamedRevert(error, ARENA_REVERT_KINDS);
}
