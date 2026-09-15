/**
 * The token lane's attested fallback (session-lanes.md §2.5): the median of Jupiter Price v3 at T − 40, T − 20 and T for
 * the verified mint, recorded through `recordAttestedSlot` at ≥ T + 60. "Attested demo" only; devnet by user opt-in
 * (Q-S6-5). Lane 6b owns this file. The relay hands it every unexpired attested slot of a token Series. The stub records nothing.
 */
import type { PrintSlot } from "@agari/markets/ops/prints";
import { NOT_BUILT, type LanePassResult } from "./lane-pass";
import type { RelayContext } from "./relay-pass";

export async function jupiterAttestPass(_ctx: RelayContext, slots: readonly PrintSlot[], _chainNow: number): Promise<LanePassResult> {
  return NOT_BUILT("jupiter attested", slots.length);
}
