/**
 * Gap RedStone opening prints past the gateway's ≈ 24 h history (session-lanes.md §1.5): posted from `print_archive`
 * rows `(redstone, feed, T)` until `lock_at`. Lane 6a owns this file. The relay calls it first with every due slot; the
 * slots it takes are skipped by the Regular RedStone and Pyth passes. The foundation stub takes nothing.
 */
import type { PrintSlot } from "@agari/markets/ops/prints";
import type { LanePassResult } from "./lane-pass";
import type { RelayContext } from "./relay-pass";

export async function gapArchivePass(_ctx: RelayContext, _due: readonly PrintSlot[], _chainNow: number): Promise<LanePassResult & { taken: ReadonlySet<string> }> {
  return { line: null, nextSec: null, taken: new Set() };
}
