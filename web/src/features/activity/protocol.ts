import type { TickerSymbol } from "@agari/core/market";
import type { Address, MarketId, Side } from "@agari/core/types";
import type { FeedTake } from "@/features/takes/protocol";

/**
 * The activity feed's frozen types (social-assistant.md §5) and the wire envelope that carries them.
 *
 * What each kind's fields mean, since the shape is shared:
 * - `fill`: one side of one fill. `side` is the exposure it adds (a buy of Up or a sell of Down is Up, as the
 *   sentiment cell counts it); `lots` the fill's lots; `amountBase` that leg's cost or proceeds; `signature` the tx.
 * - `resting-filled`: the same fill seen from the maker's seat — a call that rested at its own price and was taken
 *   (a scheduled call filling after the bell, D-088). Same fields as `fill`.
 * - `settled-win` / `settled-loss`: the seat's verdict, by core's settlement rule; `amountBase` the signed PnL.
 * - `voided`: the refund the held legs are owed or were paid.
 * - `claimable`: a payout still sitting in the seat; `amountBase` what it pays.
 * - `paid-automatically`: the settler's `redeem_for` paid the seat (D-032); `signature` is the crank's tx.
 * - `take`: a signed take; `takeId` names it and the envelope's `takes` carries the words.
 * - `copied`: reserved for S9/S14 (nothing writes it yet).
 */
export type ActivityKind = "fill" | "resting-filled" | "settled-win" | "settled-loss" | "voided" | "claimable" | "paid-automatically" | "take" | "copied";

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  wallet: Address;
  marketId: MarketId | null;
  asset: TickerSymbol | null;
  intervalSec: number | null;
  side: Side | null;
  lots: string | null;
  amountBase: string | null;
  signature: string | null;
  takeId: string | null;
  atSec: number;
}

/** `GET /api/activity*`: newest first. `configured: false` when the deployment has no index store. */
export interface ActivityFeed {
  configured: boolean;
  items: ActivityItem[];
  /** The takes the `take` items name, so a row can quote the words without a second request. */
  takes: FeedTake[];
}

/** Spec §4: the inbox and a ticker hub poll every 15 s while visible. */
export const ACTIVITY_POLL_MS = 15_000;
export const ACTIVITY_LIMIT = 50;
export const activityKey = (wallet: string | null) => ["agari", "social", "activity", wallet] as const;
export const followingKey = (wallet: string | null) => ["agari", "social", "activity", wallet, "following"] as const;
export const tickerKey = (symbol: string | null) => ["agari", "social", "ticker", symbol] as const;
