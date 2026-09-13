"use client";

import { MARKETS_POLL_MS } from "@masayume/core/constants";
import type { Reading } from "@masayume/core/schemas";
import { readRangeCapacity, type RangeCapacity } from "@masayume/markets/range";
import { keys, useReadingQuery } from "@masayume/markets/react";

/** Nested under the reserve's key so the invalidation after any reserve write refreshes it too. */
const capacityKey = (expirySec: number | null, houseLockedBase: bigint) => [...keys.rangeReserve(), "capacity", expirySec, houseLockedBase.toString()] as const;

/**
 * What the reserve would say to a round locking `houseLockedBase` on this expiry — asked before the popup, so
 * `OverExpiryCap` and `InsufficientLiquidity` are lines on the ticket rather than a revert after a signature.
 * With no quote yet the read is for zero, which still says what the expiry has locked.
 */
export function useExpiryCapacity(expirySec: number | null, houseLockedBase: bigint | null, enabled: boolean): Reading<RangeCapacity> | null {
  const locked = houseLockedBase ?? 0n;
  return useReadingQuery(capacityKey(expirySec, locked), () => readRangeCapacity(locked, expirySec as number), { pollMs: MARKETS_POLL_MS, enabled: enabled && expirySec !== null });
}
