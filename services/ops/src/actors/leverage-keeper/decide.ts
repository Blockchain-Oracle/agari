import type { LeverageMark, LeveragePosition } from "@masayume/core/leverage";
import type { MarketId, OnchainSnapshot } from "@masayume/core/types";

export type PositionAction = { kind: "settle" | "knock-out" | "hold"; positionId: bigint; marketId: MarketId; why: string };

/**
 * One live boost: settle once the venue has; knock out once the book's mark is under the line and there
 * is something to sell into; otherwise leave it. Both calls are permissionless and pay the owner, never
 * the keeper — the contract decides, the keeper only cranks.
 */
export function decidePosition(position: LeveragePosition, onchain: OnchainSnapshot, mark: LeverageMark | null): PositionAction {
  const { positionId, marketId } = position;
  if (onchain.isResolved || onchain.isVoided) return { kind: "settle", positionId, marketId, why: "the venue settled the Window" };
  if (!mark) return { kind: "hold", positionId, marketId, why: "mark unreadable" };
  if (mark.knockable && mark.filledRaw > 0n) return { kind: "knock-out", positionId, marketId, why: `mark ${mark.markBase} under the line ${mark.lineBase}` };
  if (mark.knockable) return { kind: "hold", positionId, marketId, why: `under the line ${mark.lineBase} with no bids to sell into` };
  return { kind: "hold", positionId, marketId, why: `mark ${mark.markBase} over the line ${mark.lineBase}` };
}
