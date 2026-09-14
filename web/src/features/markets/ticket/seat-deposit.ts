"use client";

import type { Address, OnchainSnapshot } from "@agari/core/types";
import { useHoldings } from "@agari/markets/react";

/**
 * The Series seat bond on the launch grid (D-026: 250,000 base = 0.25 tUSDC). agari-events pulls it on a wallet's
 * first order in a Window and refunds it at redeem. The Series account is the authority: once lane 4a's
 * `readSeries(...).seatBond` is on the read port this constant goes, and nothing else changes.
 */
const LAUNCH_SEAT_BOND_BASE = 250_000n;

/**
 * What the next order must also fund beyond its escrow: the seat bond while the wallet holds nothing in this Window
 * (first-call.md §6 — "no holdings" stands in for "no seat"; a wallet that sold out still has its seat, and is
 * asked for a quarter it will not be charged, never the reverse). Zero while unknown, and off the wallet route.
 */
export function useSeatDeposit(wallet: Address | null, onchain: OnchainSnapshot | null): bigint {
  const holdings = useHoldings(wallet, onchain);
  if (wallet === null || !holdings?.ok) return 0n;
  return holdings.value.upRaw === 0n && holdings.value.downRaw === 0n ? LAUNCH_SEAT_BOND_BASE : 0n;
}
