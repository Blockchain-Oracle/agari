import type { MarketId } from "@agari/core/types";

/**
 * A one-shot stake for the next ticket that opens on one Window — the context-carrying entry `useTicket` leaves room
 * for. The hedge card sets it just before it selects its Window; the ticket takes it once, so a later tap on the same
 * Window starts empty again, as the hero entry does.
 */
let pending: { marketId: MarketId; stakeBase: bigint } | null = null;

export function presetStake(marketId: MarketId, stakeBase: bigint): void {
  pending = { marketId, stakeBase };
}

export function takeStakePreset(marketId: MarketId): bigint | null {
  if (pending?.marketId !== marketId) return null;
  const { stakeBase } = pending;
  pending = null;
  return stakeBase;
}
