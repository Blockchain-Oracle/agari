import type { LeverageMark, LeveragePosition } from "@agari/core/leverage";
import type { MarketId, OnchainSnapshot } from "@agari/core/types";

export type PositionAction = { kind: "settle" | "knock-out" | "hold"; positionId: bigint; marketId: MarketId; why: string };

/**
 * One live boost: settle once the venue has; knock out once the chain would accept it; otherwise leave it.
 *
 * `mark.knockable` is the chain's own test (D-114): the whole position sells into rested depth and at that mark it
 * is under its line. So a position can be under water and still held, when the rested book cannot take all of it;
 * that is said in the log rather than sent and refused. Both calls are permissionless and pay the owner, never the
 * keeper: the program decides, the keeper only cranks.
 */
export function decidePosition(position: LeveragePosition, onchain: OnchainSnapshot, mark: LeverageMark | null): PositionAction {
  const { positionId, marketId } = position;
  if (onchain.isResolved || onchain.isVoided) return { kind: "settle", positionId, marketId, why: "the venue settled the Window" };
  if (!mark) return { kind: "hold", positionId, marketId, why: "mark unreadable" };
  if (mark.knockable) return { kind: "knock-out", positionId, marketId, why: `mark ${mark.markBase} under the line ${mark.lineBase}` };
  if (mark.filledRaw < position.quantityRaw) {
    return { kind: "hold", positionId, marketId, why: `rested depth takes ${mark.filledRaw} of ${position.quantityRaw}: no knock-out can be judged` };
  }
  return { kind: "hold", positionId, marketId, why: `mark ${mark.markBase} over the line ${mark.lineBase}` };
}
