import type { Reading } from "@agari/core/schemas";
import type { ClockSync } from "@agari/core/types";
import { secToMs } from "@agari/core/units";
import { getClient } from "../runtime/read-runtime";
import { applyClockSync } from "./clock";
import { withReading } from "./reading";

/** Samples the chain head once; block timestamps are whole seconds, so half the round-trip is the best midpoint we have. */
export async function syncClock(): Promise<Reading<ClockSync>> {
  return withReading("clock", async () => {
    const startedMs = Date.now();
    const block = await getClient().getViemClient().getBlock();
    const rttMs = Date.now() - startedMs;
    const chainMs = secToMs(Number(block.timestamp)) + rttMs / 2;
    const sync: ClockSync = { offsetMs: Math.round(chainMs - Date.now()), rttMs, blockNumber: Number(block.number) };
    applyClockSync(sync);
    return sync;
  });
}
