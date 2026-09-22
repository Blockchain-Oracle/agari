import type { BlockerKind } from "@agari/core/copy";
import type { LeverageQuote } from "@agari/core/leverage";
import { isSettled, type MarketPhase } from "@agari/core/lifecycle";
import type { Reading } from "@agari/core/schemas";
import { admissibilityBlocker, belowMinStake } from "@agari/core/sizing";
import type { Diagnosis, HaltEntry, LaneBasis, Quote, Side } from "@agari/core/types";
import type { FundingCheck } from "@agari/markets";
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
  /** Funded beside the stake on this order: the seat bond while the wallet has no seat on the Window (useSeatDeposit). Absent = 0. */
  depositBase?: bigint;
  decimals: number;
  quote: Reading<Quote | null> | null;
  quoting: boolean;
  quoteStale: boolean;
  funding: FundingCheck | null;
  /** The Window's lane as ops sees it (session-lanes.md §5); absent = no session read to judge by. */
  lane?: LaneGuardInput | null;
  /** The geofence's verdict for this browser (D-095); absent = open, which is what every non-web caller is. */
  region?: boolean;
}

export interface LaneGuardInput {
  basis: LaneBasis;
  /** Regular hours now; null while the session read hasn't answered. */
  sessionOpen: boolean | null;
  /** This Window's asset on `/session.halts`. */
  halt: HaltEntry | null;
  /** The roller's word for this Window's lane key (`paused: no signed source`, `paused: corporate action (split)`). */
  laneState: string | null;
}

/** What the reserve said about the boost this stake asks for. */
export interface BoostState {
  quote: LeverageQuote | null;
  loading: boolean;
  error: Diagnosis | null;
}

export const PHASE_BLOCKERS: Partial<Record<MarketPhase, BlockerKind>> = {
  upcoming: "upcoming",
  pendingOpeningPrint: "pending-opening-print",
  noEntryBuffer: "no-entry-buffer",
  locked: "locked",
  settledUnclaimed: "locked",
  finalized: "locked",
  voided: "locked",
};

export function fundingBlocker(funding: FundingCheck | null): BlockerKind | null {
  if (!funding || funding.ok) return null;
  if (funding.diagnosis.kind === "out-of-gas") return "out-of-gas";
  if (funding.diagnosis.kind === "insufficient-collateral") return "over-balance";
  // A failed pre-check read is not a refusal: the order lane re-checks funding before it sends.
  return null;
}

/**
 * Why this Window can't take a call for a session, source or corporate reason, named before the generic phase word:
 * a halt holds any Window still open to calls; a paused lane holds one waiting on its opening print; a settled Regular
 * Window outside the session says when the market opens. A listed Window before its open is no longer a blocker on the
 * Regular and Gap lanes: it takes a scheduled call (D-088, `isRestable`), so the ticket switches modes instead.
 */
export function laneBlocker(phase: MarketPhase, lane: LaneGuardInput | null | undefined): BlockerKind | null {
  if (!lane) return null;
  const beforeOpen = phase === "upcoming" || phase === "pendingOpeningPrint";
  if (lane.halt && (beforeOpen || phase === "trading")) return "halted";
  if (beforeOpen && lane.laneState?.startsWith("paused: corporate action")) return "corporate-action";
  if (beforeOpen && lane.laneState?.startsWith("paused")) return "lane-paused";
  if (lane.basis === "regular" && lane.sessionOpen === false && isSettled(phase)) return "session-closed";
  return null;
}

/** A Window this young has an empty book because the maker's pass has not reached it yet, not because nobody quotes it. */
export const FRESH_BOOK_SEC = 180;

export function isFreshBook(tradingStartSec: number, nowMs: number): boolean {
  const ageSec = Math.floor(nowMs / 1000) - tradingStartSec;
  return ageSec >= 0 && ageSec < FRESH_BOOK_SEC;
}

/** Everything before the quote: the session, the Window, the stake against what can back it. */
export function commonBlocker(i: TicketBlockerInput): BlockerKind | null {
  // Before the wallet: a held visitor is not missing a connection, and telling them to fix one would lie.
  if (i.region) return "region";
  if (!i.session.isConnected) return i.session.isConnecting ? "connecting" : "disconnected";
  if (!i.session.isRightChain) return "wrong-chain";
  // The signer binds one effect after the session settles; treat the gap as still connecting.
  if (!i.hasSigner) return "connecting";
  if (i.placing) return "placing";
  if (i.phase === null) return "syncing";
  const lane = laneBlocker(i.phase, i.lane);
  if (lane) return lane;
  const phaseBlocker = PHASE_BLOCKERS[i.phase];
  if (phaseBlocker) return phaseBlocker;
  if (i.availableBase === 0n) return "no-funds";
  if (i.side === null) return "no-side";
  if (i.stakeBase === 0n) return "no-stake";
  if (belowMinStake(i.stakeBase, i.decimals)) return "below-min-stake";
  if (i.availableBase !== null && i.stakeBase + (i.depositBase ?? 0n) > i.availableBase) return "over-balance";
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
