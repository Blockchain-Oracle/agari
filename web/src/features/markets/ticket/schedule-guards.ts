import type { BlockerKind } from "@agari/core/copy";
import { isRestable, type MarketPhase } from "@agari/core/lifecycle";
import { isPriceCents, MAX_RESTING_PER_SEAT, type RestingQuote } from "@agari/core/orders";
import type { Side } from "@agari/core/types";
import type { FundingCheck } from "@agari/markets";
import type { WalletSession } from "@/lib/wallet-session";
import type { Crossing } from "./crossing";
import { fundingBlocker, laneBlocker, PHASE_BLOCKERS, type LaneGuardInput } from "./ticket-guards";

export interface ScheduleBlockerInput {
  session: WalletSession;
  hasSigner: boolean;
  placing: boolean;
  phase: MarketPhase | null;
  lane?: LaneGuardInput | null;
  side: Side | null;
  priceCents: number;
  stakeBase: bigint;
  /** Wallet spendable plus venue credit; null until the balance sheet has answered. */
  availableBase: bigint | null;
  /** The seat bond this call also funds while the wallet holds no seat on the Window. */
  depositBase: bigint;
  /** Core `restingQuote` over the Series grid; null while the grid is unread. */
  sized: RestingQuote | null;
  /** The book already offers the other side at this price: the call would take, not rest (6109). */
  crossing: Crossing | null;
  /** The wallet's calls already resting on this Window; null until read. */
  restingCount: number | null;
  funding: FundingCheck | null;
  /** The geofence's verdict for this browser (D-095); absent = open. */
  region?: boolean;
}

/**
 * The scheduled call's ladder, in the same order as the taker's (`deriveBlocker`): the session and the wallet, the
 * lane, then the call itself — a side, a price on the grid, a stake that buys at least `min_lots`, the money to hold
 * it, room on the seat, and a price that rests rather than takes. The label IS the blocker (UX-DR3/UX-DR4).
 */
export function deriveScheduleBlocker(i: ScheduleBlockerInput): BlockerKind | null {
  if (i.region) return "region";
  if (!i.session.isConnected) return i.session.isConnecting ? "connecting" : "disconnected";
  if (!i.session.isRightChain) return "wrong-chain";
  if (!i.hasSigner) return "connecting";
  if (i.placing) return "placing";
  if (i.phase === null) return "syncing";
  const lane = laneBlocker(i.phase, i.lane);
  if (lane) return lane;
  // The dock switches back to the taker's ticket once the Window trades; between renders the phase word stands in.
  if (!isRestable(i.phase)) return PHASE_BLOCKERS[i.phase] ?? "quoting";
  if (i.availableBase === 0n) return "no-funds";
  if (i.side === null) return "no-side";
  if (!isPriceCents(i.priceCents)) return "no-price";
  if (i.stakeBase === 0n) return "no-stake";
  if (i.sized === null) return "quoting";
  if (!i.sized.ok) return i.sized.blocker === "too-small" ? "below-min-stake" : i.sized.blocker === "no-price" ? "no-price" : "no-stake";
  if (i.availableBase !== null && i.sized.quote.maxCostBase + i.depositBase > i.availableBase) return "over-balance";
  if (i.restingCount !== null && i.restingCount >= MAX_RESTING_PER_SEAT) return "too-many-resting";
  if (i.crossing) return "rest-would-cross";
  return fundingBlocker(i.funding);
}
