"use client";

import { useCallback } from "react";
import { ReadingBoundary } from "@/components/states";
import { useWalletSession } from "@/lib/wallet-session";
import { useChainNowMs } from "../markets/useChainNow";
import { PARLAY } from "./copy";
import { ParlayCard } from "./ParlayCard";
import { useParlayTickets, type ParlayTicketView } from "./useParlayTickets";
import { useParlayWrites } from "./useParlayWrites";

interface ParlaySlipProps {
  symbol: string;
  decimals: number;
}

/**
 * `ParlaySlip` (`reference/yosuku/components/ParlaySlip.tsx`): the connected wallet's tickets,
 * live first, each leg flipping as its Window settles. The reference's keeper cranked settlement;
 * here the crank is on the row (permissionless), and a won ticket claims to its owner.
 */
export function ParlaySlip({ symbol, decimals }: ParlaySlipProps) {
  const { address } = useWalletSession();
  const reading = useParlayTickets(address);
  const nowMs = useChainNowMs();
  const writes = useParlayWrites();

  const onClaim = useCallback((ticket: ParlayTicketView) => void writes.claim(ticket.parlayId, ticket.maxPayoutBase, decimals, symbol), [writes, decimals, symbol]);
  const onSettle = useCallback(
    (ticket: ParlayTicketView, legIdx: number) => {
      const leg = ticket.legs[legIdx];
      if (leg) void writes.settleLeg(ticket.parlayId, legIdx, leg.marketId);
    },
    [writes],
  );

  if (!address) return <div className="pl-slip-empty">{PARLAY.slip.emptyDisconnected}</div>;

  return (
    <ReadingBoundary reading={reading} shape="row">
      {(tickets) =>
        tickets.length === 0 ? (
          <div className="pl-slip-empty">{PARLAY.slip.emptyConnected}</div>
        ) : (
          <div className="pl-slip">
            {tickets.map((ticket) => (
              <ParlayCard key={ticket.parlayId.toString()} ticket={ticket} nowMs={nowMs} symbol={symbol} decimals={decimals} busy={writes.busy} onClaim={onClaim} onSettle={onSettle} />
            ))}
          </div>
        )
      }
    </ReadingBoundary>
  );
}
