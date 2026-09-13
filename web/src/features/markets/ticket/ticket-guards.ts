import type { BlockerKind } from "@masayume/core/copy";
import type { LeverageQuote } from "@masayume/core/leverage";
import type { MarketPhase } from "@masayume/core/lifecycle";
import type { Reading } from "@masayume/core/schemas";
import { admissibilityBlocker, belowMinStake } from "@masayume/core/sizing";
import type { Diagnosis, Quote, Side } from "@masayume/core/types";
import type { FundingCheck } from "@masayume/markets";
import type { WalletSession } from "@/lib/wallet-session";

export interface TicketBlockerInput {
  session: WalletSession;
  hasSigner: boolean;
  phase: MarketPhase | null;
  placing: boolean;
  side: Side | null;
  /** Wallet spendable plus venue payout credit; null until the balance sheet has answered. */
  availableBase: bigint | null;
  stakeBase: bigint;
  decimals: number;
  quote: Reading<Quote | null> | null;
  quoting: boolean;
  quoteStale: boolean;
  funding: FundingCheck | null;
}

/** What the reserve said about the boost this stake asks for. */
export interface BoostState {
  quote: LeverageQuote | null;
  loading: boolean;
  error: Diagnosis | null;
}

const PHASE_BLOCKERS: Partial<Record<MarketPhase, BlockerKind>> = {
  upcoming: "upcoming",
  pendingOpeningPrint: "pending-opening-print",
  noEntryBuffer: "no-entry-buffer",
  locked: "locked",
  settledUnclaimed: "locked",
  finalized: "locked",
  voided: "locked",
};

function fundingBlocker(funding: FundingCheck | null): BlockerKind | null {
  if (!funding || funding.ok) return null;
  if (funding.diagnosis.kind === "out-of-gas") return "out-of-gas";
  if (funding.diagnosis.kind === "insufficient-collateral") return "over-balance";
  // A failed pre-check read is not a refusal: the order lane re-checks funding before it sends.
  return null;
}

/** Everything before the quote: the session, the Window, the stake against what can back it. */
export function commonBlocker(i: TicketBlockerInput): BlockerKind | null {
  if (!i.session.isConnected) return i.session.isConnecting ? "connecting" : "disconnected";
  if (!i.session.isRightChain) return "wrong-chain";
  // The signer binds one effect after the session settles; treat the gap as still connecting.
  if (!i.hasSigner) return "connecting";
  if (i.placing) return "placing";
  if (i.phase === null) return "syncing";
  const phaseBlocker = PHASE_BLOCKERS[i.phase];
  if (phaseBlocker) return phaseBlocker;
  if (i.availableBase === 0n) return "no-funds";
  if (i.side === null) return "no-side";
  if (i.stakeBase === 0n) return "no-stake";
  if (belowMinStake(i.stakeBase, i.decimals)) return "below-min-stake";
  if (i.availableBase !== null && i.stakeBase > i.availableBase) return "over-balance";
  return fundingBlocker(i.funding);
}

/** Ordered so the first fixable reason is the one the CTA names; the label IS the blocker (UX-DR3/UX-DR4). */
export function deriveBlocker(i: TicketBlockerInput): BlockerKind | null {
  const common = commonBlocker(i);
  if (common) return common;
  if (i.quoting || i.quote === null) return "quoting";
  if (!i.quote.ok) return "stale-quote";
  if (i.quote.value === null) return "no-liquidity-at-size";
  // The book can fill part of it. Yosuku caps a stake to money only, because it has no book; ours has one, so the
  // guard names what the book can actually take — and leaves the typed amount alone, the reference's own rule.
  if (i.quote.value.partial) return "over-book";
  const band = admissibilityBlocker(i.quote.value.avgPriceBps);
  if (band) return band;
  if (i.quoteStale) return "stale-quote";
  return null;
}

/** The same order for a boost, whose quote is the reserve's own answer: its refusal is named, never a stale book. */
export function deriveBoostBlocker(i: TicketBlockerInput, boost: BoostState): BlockerKind | null {
  const common = commonBlocker(i);
  if (common) return common;
  if (boost.error) return "boost-refused";
  if (boost.loading || !boost.quote) return "quoting";
  return null;
}
