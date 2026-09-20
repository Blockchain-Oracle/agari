import type { MarketId, Side } from "../types/market";
import type { Address } from "../types/primitives";

/** The ticket's states, in the contract's enum order. */
export type ParlayStatus = "live" | "won" | "lost" | "void" | "claimed";
export const PARLAY_STATUSES: readonly ParlayStatus[] = ["live", "won", "lost", "void", "claimed"];

export type ParlayLegStatus = "pending" | "won" | "lost" | "void";
export const PARLAY_LEG_STATUSES: readonly ParlayLegStatus[] = ["pending", "won", "lost", "void"];

export function parlayStatusOf(index: number): ParlayStatus {
  const status = PARLAY_STATUSES[index];
  if (!status) throw new Error(`unknown parlay status ${index}`);
  return status;
}

export function parlayLegStatusOf(index: number): ParlayLegStatus {
  const status = PARLAY_LEG_STATUSES[index];
  if (!status) throw new Error(`unknown leg status ${index}`);
  return status;
}

/** A leg as the opener names it: a Window and a side. Its price is the venue's book, read on-chain at open. */
export interface ParlayLegInput {
  marketId: MarketId;
  side: Side;
}

export interface ParlayLeg extends ParlayLegInput {
  status: ParlayLegStatus;
  expirySec: number;
  resolvedAtSec: number | null;
  /** Collateral per whole contract of the chosen side at open — the leg's priced win probability. */
  priceRaw: bigint;
}

export interface ParlayTicket {
  parlayId: bigint;
  owner: Address;
  status: ParlayStatus;
  legCount: number;
  wonCount: number;
  openedAtSec: number;
  lastExpirySec: number;
  stakeBase: bigint;
  maxPayoutBase: bigint;
  /** `maxPayout − stake`: the reserve's part of the escrow. */
  houseLockedBase: bigint;
  /** The combined (surcharged) win probability the contract recomputed, per whole unit of collateral. */
  combinedProbRaw: bigint;
  legs: ParlayLeg[];
}

export interface ParlayParams {
  marginBps: number;
  maxExposureBps: number;
  correlationBps: number;
  maxLegs: number;
  maxPayoutCapBase: bigint;
  maxExpiryLockedBase: bigint;
  minCombinedProbRaw: bigint;
  /** The least depth (raw contracts) a leg is priced over; a bigger payout is priced over its own size. */
  priceDepthRaw: bigint;
  /** The widest gap, in YES ticks, between a leg's price and the other side's touch the reserve prices through; 0 = off. */
  maxSpreadTicks: number;
  /** Only orders that have rested this many slots price a leg (a floor under the Series' own). */
  minRestSlots: number;
  /** A leg is refused once its Window has less than this left. */
  minTimeLeftSec: number;
}

/** Where the reserve lives on one chain — regenerated from `contracts/deployments` (AD-10). */
export interface ParlayDeployment {
  chainId: number;
  parlayReserve: Address;
  fromBlock: bigint;
}

/** The reserve's own balance sheet: what it can front, what it has fronted, and its tunables. */
export interface ParlayReserveState {
  deployment: ParlayDeployment;
  params: ParlayParams;
  liquidBase: bigint;
  lockedBase: bigint;
  totalValueBase: bigint;
  utilizationBps: number;
  supplyShares: bigint;
  paused: boolean;
  decimals: number;
}

export type ParlayMode = { kind: "fixStake"; stakeBase: bigint } | { kind: "fixPayout"; maxPayoutBase: bigint };

/** One priced ticket, every figure the contract's own (`previewOpen`) or derived from it without a float. */
export interface ParlayQuote {
  legPricesRaw: bigint[];
  /** Per-leg win probability in bps, for display. */
  legProbBps: number[];
  combinedProbRaw: bigint;
  /** Π of the leg prices before the same-instant floor — the "lottery" framing the reference shows. */
  rawCombinedProbRaw: bigint;
  /** Two or more legs settle at the same instant, so the correlation floor applied. */
  correlated: boolean;
  stakeBase: bigint;
  maxPayoutBase: bigint;
  /** `maxPayout / stake`, in thousandths — the "×N" the ticket headlines. */
  multiplierMilli: number;
  decimals: number;
  quotedAtMs: number;
}

export type ParlayRefusal =
  | { kind: "legs"; count: number; min: number; max: number }
  | { kind: "thin-book"; legIdx: number; availableRaw: bigint; neededRaw: bigint }
  | { kind: "long-shot"; combinedProbRaw: bigint; minCombinedProbRaw: bigint }
  | { kind: "underpriced"; stakeBase: bigint; maxPayoutBase: bigint }
  | { kind: "over-payout-cap"; maxPayoutBase: bigint; capBase: bigint }
  | { kind: "zero" };

/** Reserve writes: every one journals, simulates, sends and books through the same lane shape as a vault write. */
export type ParlayIntent =
  | { kind: "parlay-open"; legs: ParlayLegInput[]; maxPayoutBase: bigint; maxStakeBase: bigint }
  /** Permissionless: anyone may settle a leg whose Window the venue has resolved or voided. */
  | { kind: "parlay-resolve-leg"; parlayId: bigint; legIdx: number; marketId: MarketId }
  /** Permissionless: the payout only ever goes to the ticket's owner. */
  | { kind: "parlay-claim"; parlayId: bigint }
  | { kind: "parlay-supply"; amountBase: bigint }
  | { kind: "parlay-withdraw"; shares: bigint };

/**
 * How far above the quoted stake a buyer's cap is sent. The chain prices every leg at its own slot, so the stake
 * it charges can sit a little over the quote; inside this it charges the fresh price, past it it refuses.
 */
export const PARLAY_STAKE_HEADROOM_BPS = 300;

export const PARLAY_NOT_DEPLOYED = "ParlayReserve is not deployed on this network yet" as const;
