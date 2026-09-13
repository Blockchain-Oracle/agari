import { orderExpirySec } from "@masayume/core/lifecycle";
import { diagnosis, type OnchainSnapshot } from "@masayume/core/types";
import { msToSec, secToNs } from "@masayume/core/units";
import { OrderRefusedError } from "../errors";

/**
 * Nanoseconds exist only here (Time convention). The expiry is a dead-man's switch one headroom past
 * now, never beyond the market (canon #6); inside the no-entry buffer there is no admissible expiry to send.
 */
export function orderExpiryNs(nowMs: number, onchain: OnchainSnapshot, intervalSec: number): bigint {
  const expirySec = orderExpirySec(msToSec(nowMs), onchain.expirySec, intervalSec);
  if (expirySec === null) throw new OrderRefusedError(diagnosis("market-not-trading", "inside the no-entry buffer before expiry"));
  return secToNs(expirySec);
}
