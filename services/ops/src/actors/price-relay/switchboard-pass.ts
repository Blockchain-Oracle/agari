/**
 * Switchboard token-lane prints (session-lanes.md §2.4): per T at T + 10 s, one quote for every due close slot, sent as
 * `[quote ix, record]` in parallel; opens copied with `public_copy_open_from_prev`. Lane 6b owns this file. The relay
 * hands it every unexpired Switchboard slot (due or not); missed slots are reported by the relay. The stub records nothing.
 */
import type { PrintSlot } from "@agari/markets/ops/prints";
import { NOT_BUILT, type LanePassResult } from "./lane-pass";
import type { RelayContext } from "./relay-pass";

export async function switchboardPass(_ctx: RelayContext, slots: readonly PrintSlot[], _chainNow: number): Promise<LanePassResult> {
  return NOT_BUILT("switchboard", slots.length);
}
