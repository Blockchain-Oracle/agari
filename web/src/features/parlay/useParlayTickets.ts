"use client";

import type { ParlayLeg, ParlayTicket } from "@masayume/core/parlay";
import type { Reading } from "@masayume/core/schemas";
import type { Address, IndexedStatus, MarketId } from "@masayume/core/types";
import { marketsProvider, withReading } from "@masayume/markets";
import { listParlaysOf } from "@masayume/markets/parlay";
import { keys, useReadingQuery } from "@masayume/markets/react";

/** A leg with the Window it names read beside it, so the slip can say what the leg is and when it can settle. */
export interface ParlayLegView extends ParlayLeg {
  asset: string | null;
  intervalSec: number | null;
  openingPriceRaw: bigint | null;
  /** The venue has resolved or voided the Window: the leg can be settled now. */
  settledOnchain: boolean;
}

export interface ParlayTicketView extends Omit<ParlayTicket, "legs"> {
  legs: ParlayLegView[];
}

const SETTLED: ReadonlySet<IndexedStatus> = new Set<IndexedStatus>(["Resolved", "Voided", "Finalized"]);

/** Nested under the adapter's key so one invalidation after a write refreshes both. */
export const parlayTicketsKey = (wallet: string | null) => [...keys.parlays(wallet), "view"] as const;

/** The wallet's tickets with each leg's Window read from the indexer — one row per distinct Window. */
export async function listParlayTickets(wallet: Address): Promise<Reading<ParlayTicketView[]>> {
  return withReading(`parlay-tickets:${wallet}`, async (inner) => {
    const tickets = inner(await listParlaysOf(wallet));
    const ids = [...new Set(tickets.flatMap((ticket) => ticket.legs.map((leg) => leg.marketId)))];
    const rows = await Promise.all(ids.map(async (id) => [id, inner(await marketsProvider.getMarket(id))] as const));
    const byId = new Map<MarketId, (typeof rows)[number][1]>(rows);
    return tickets.map((ticket) => ({
      ...ticket,
      legs: ticket.legs.map((leg) => {
        const market = byId.get(leg.marketId) ?? null;
        return {
          ...leg,
          asset: market?.asset ?? null,
          intervalSec: market?.intervalSec ?? null,
          openingPriceRaw: market?.openingPriceRaw ?? null,
          settledOnchain: market ? SETTLED.has(market.status) : false,
        };
      }),
    }));
  });
}

/** A leg settles the moment its Window does; fifteen seconds (the lanes\' poll) left a won ticket reading "open" for most of a minute. */
const PARLAY_SLIP_POLL_MS = 8_000;

export function useParlayTickets(wallet: Address | null): Reading<ParlayTicketView[]> | null {
  return useReadingQuery(parlayTicketsKey(wallet), () => listParlayTickets(wallet as Address), { pollMs: PARLAY_SLIP_POLL_MS, enabled: wallet !== null });
}
