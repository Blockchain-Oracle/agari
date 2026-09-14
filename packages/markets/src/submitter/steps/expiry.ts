import { orderExpirySec, type EntryWindow } from "@agari/core/lifecycle";
import { diagnosis } from "@agari/core/types";
import { msToSec } from "@agari/core/units";
import { OrderRefusedError } from "../errors";

/**
 * The order's `expire_ts`: a dead-man's switch one headroom past now, never beyond `lock_at` (canon #6; the engine
 * refuses `expire_ts > lock_at` with 6108). Inside the no-entry buffer there is no admissible expiry to send.
 */
export function orderExpiry(nowMs: number, window: EntryWindow): number {
  const expirySec = orderExpirySec(msToSec(nowMs), window);
  if (expirySec === null) throw new OrderRefusedError(diagnosis("market-not-trading", "inside the no-entry buffer before the Window locks"));
  return expirySec;
}
