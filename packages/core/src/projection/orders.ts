/**
 * A wallet's resting calls (D-088), projected from the index's `idx_orders` rows (`wallet/{addr}/orders?open=1`): what
 * rests, at what price in the wallet's own terms, how much is held, and where in its life the call is. Pure: the caller
 * passes the Window's instants, the Series grid and the chain clock.
 */
import type { MarketId, Side } from "../types/market";
import type { Signature } from "../types/primitives";
import { restUntilOf, type RestUntil } from "../orders/rest-expiry";
import { PAIR_TICKS, TICKS_PER_CENT, type RestingGrid } from "../orders/resting-quote";
import { msToSec } from "../units/time";

/** The `idx_orders` columns the view reads, as the index API sends them (u64/NUMERIC as decimal strings). */
export interface RestingOrderRow {
  signature: string;
  market: string;
  owner: string;
  seat: number;
  /** 0 BUY_YES, 1 SELL_YES, 2 BUY_NO, 3 SELL_NO. */
  kind: number;
  /** 0 Normal, 1 FOK, 2 IOC, 3 PostOnly. */
  order_type: number;
  /** YES ticks. */
  limit_price: number;
  lots: string;
  filled_lots: string;
  rested_lots: string;
  remaining_lots: string;
  expire_ts_sec: string;
  ts_sec: string;
  status: "done" | "open" | "filled" | "cancelled" | "expired";
  rested_node: number | null;
  rested_seq: string | null;
}

export interface RestingOrderWindow {
  marketId: MarketId;
  asset: string;
  intervalSec: number;
  tradingStartSec: number;
  lockAtSec: number;
  expirySec: number;
  decimals: number;
  grid: Pick<RestingGrid, "lotBase" | "cashUnit">;
}

export type RestingStatus = "resting-for-open" | "resting" | "filled" | "cancelled" | "expired";

export interface RestingOrderView {
  /** `signature` of the placement: one row per placement, so it is the row's identity. */
  id: string;
  signature: Signature;
  marketId: MarketId;
  asset: string;
  intervalSec: number;
  tradingStartSec: number;
  lockAtSec: number;
  expirySec: number;
  decimals: number;
  seat: number;
  side: Side;
  /** The price in the wallet's own terms ("UP at 55¢"). */
  priceCents: number;
  yesTicks: number;
  lots: bigint;
  filledLots: bigint;
  remainingLots: bigint;
  /** `remainingLots × lotBase`: what still rests, in outcome base units. */
  contractsRaw: bigint;
  /** `remainingLots × ownTicks × cashUnit`: what the resting remainder still holds. */
  escrowBase: bigint;
  status: RestingStatus;
  placedSec: number;
  expireSec: number;
  restUntil: RestUntil;
  /** The Book handle a cancel names; null once the order is off the Book. */
  handle: { node: number; seq: bigint } | null;
}

const BUY_YES = 0;
const SELL_YES = 1;

/** A YES kind's own price is the YES price; a NO kind's is the complement (events-engine.md §2). */
const isYesKind = (kind: number): boolean => kind === BUY_YES || kind === SELL_YES;
const isBuy = (kind: number): boolean => kind === BUY_YES || kind === 2;

function statusOf(row: RestingOrderRow, w: RestingOrderWindow, nowSec: number): RestingStatus {
  switch (row.status) {
    case "open":
      if (nowSec >= Number(row.expire_ts_sec)) return "expired";
      return nowSec < w.tradingStartSec ? "resting-for-open" : "resting";
    case "filled":
      return "filled";
    case "cancelled":
      return "cancelled";
    case "expired":
      return "expired";
    case "done":
      return BigInt(row.filled_lots) > 0n ? "filled" : "cancelled";
  }
}

export function restingOrderView(row: RestingOrderRow, w: RestingOrderWindow, nowMs: number): RestingOrderView {
  const yesTicks = row.limit_price;
  const ownTicks = isYesKind(row.kind) ? yesTicks : PAIR_TICKS - yesTicks;
  // A buy adds the side it names; a sell of one side is exposure to the other.
  const side: Side = isYesKind(row.kind) === isBuy(row.kind) ? "up" : "down";
  const remainingLots = BigInt(row.remaining_lots);
  const expireSec = Number(row.expire_ts_sec);
  const status = statusOf(row, w, msToSec(nowMs));
  const onBook = status === "resting-for-open" || status === "resting";
  return {
    id: row.signature,
    signature: row.signature as Signature,
    marketId: w.marketId,
    asset: w.asset,
    intervalSec: w.intervalSec,
    tradingStartSec: w.tradingStartSec,
    lockAtSec: w.lockAtSec,
    expirySec: w.expirySec,
    decimals: w.decimals,
    seat: row.seat,
    side,
    priceCents: ownTicks / TICKS_PER_CENT,
    yesTicks,
    lots: BigInt(row.lots),
    filledLots: BigInt(row.filled_lots),
    remainingLots,
    contractsRaw: remainingLots * w.grid.lotBase,
    escrowBase: isBuy(row.kind) ? remainingLots * BigInt(ownTicks) * w.grid.cashUnit : 0n,
    status,
    placedSec: Number(row.ts_sec),
    expireSec,
    restUntil: restUntilOf(expireSec, w),
    handle: onBook && row.rested_node !== null && row.rested_seq !== null ? { node: row.rested_node, seq: BigInt(row.rested_seq) } : null,
  };
}

/** Newest placement first, the ones still on the Book before the rest. */
export function sortRestingViews(views: readonly RestingOrderView[]): RestingOrderView[] {
  const rank = (v: RestingOrderView) => (v.status === "resting-for-open" || v.status === "resting" ? 0 : 1);
  return [...views].sort((a, b) => rank(a) - rank(b) || b.placedSec - a.placedSec);
}
