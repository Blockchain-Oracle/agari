import type { LedgerFill, LedgerSetAction, LedgerSide } from "@masayume/core/projection";
import { toMarketId, type Address, type Hex } from "@masayume/core/types";
import { secToMs } from "@masayume/core/units";
import type { FillRow, RouterActionRecord } from "@somnia-chain/markets-sdk";
import { bigintOrZero, numberOf } from "./scalars";

/**
 * The wallet's own side of a fill.
 *
 * The seat comes first: a maker's side is on the fill, a taker's is on its order, which the
 * indexer has from the moment the order landed — the fill's own `takerSide` is a lagging copy
 * that can still be null on a row that already names its taker (the SDK's own precedence).
 * A fill whose side is not bridged yet is skipped rather than guessed; the caller counts those.
 */
export function toLedgerFill(wallet: Address, fill: FillRow): LedgerFill | null {
  const owner = wallet.toLowerCase();
  const takerOwner = (fill.takerOrder?.owner ?? fill.taker ?? "").toLowerCase();
  const seat = (fill.maker ?? "").toLowerCase() === owner ? "maker" : takerOwner === owner ? "taker" : null;
  const side = seat === "maker" ? fill.makerSide : seat === "taker" ? (fill.takerOrder?.side ?? fill.takerSide) : null;
  if (!side) return null;
  return {
    marketId: toMarketId(fill.market),
    side: side as LedgerSide,
    quantityRaw: bigintOrZero(fill.quantity),
    yesPriceRaw: bigintOrZero(fill.fillPrice),
    atMs: secToMs(numberOf(fill.timestamp) ?? 0),
    txHash: fill.txHash as Hex,
  };
}

/** Mints and merges move a complete set; a Redeem settles a position and is the settlement rule's job, not a cost event. */
export function toSetAction(action: RouterActionRecord): LedgerSetAction | null {
  if (!action.market) return null;
  const kind = action.kind === "MintCompleteSet" ? "mint" : action.kind === "MergeCompleteSet" ? "merge" : null;
  if (!kind) return null;
  return { marketId: toMarketId(action.market), kind, amountRaw: bigintOrZero(action.amount), atMs: secToMs(numberOf(action.timestamp) ?? 0), txHash: action.txHash as Hex };
}
