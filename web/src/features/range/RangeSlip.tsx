"use client";

import { useCallback } from "react";
import { ReadingBoundary } from "@/components/states";
import { useWalletSession } from "@/lib/wallet-session";
import { useChainNowMs } from "../markets/useChainNow";
import { RANGE } from "./copy";
import { RangeCard } from "./RangeCard";
import { useRangeRounds, type RangeRoundView } from "./useRangeRounds";
import { useRangeWrites } from "./useRangeWrites";

interface RangeSlipProps {
  symbol: string;
  decimals: number;
  staleAfterSec: number;
  /** Which rounds this page owns: the reserve holds both kinds, and each page shows its own. */
  kind: RangeRoundView["kind"]["kind"];
  /** The page's own words for an empty slip; the range's by default. */
  empty?: { connected: string; disconnected: string };
}

/** The connected wallet's rounds of one kind, live first; the crank, the stale void and the claim are on the row. */
export function RangeSlip({ symbol, decimals, staleAfterSec, kind, empty }: RangeSlipProps) {
  const { address } = useWalletSession();
  const reading = useRangeRounds(address);
  const nowMs = useChainNowMs();
  const writes = useRangeWrites();
  const words = empty ?? { connected: RANGE.slip.emptyConnected, disconnected: RANGE.slip.emptyDisconnected };

  const onClaim = useCallback((round: RangeRoundView) => void writes.claim(round.roundId, round.maxPayoutBase, decimals, symbol), [writes, decimals, symbol]);
  const onSettle = useCallback((round: RangeRoundView) => void writes.settle(round.roundId, round.marketId), [writes]);
  const onVoidStale = useCallback((round: RangeRoundView) => void writes.voidStale(round.roundId), [writes]);

  if (!address) return <div className="pl-slip-empty">{words.disconnected}</div>;

  return (
    <ReadingBoundary reading={reading} shape="row">
      {(all) => {
        const rounds = all.filter((round) => round.kind.kind === kind);
        return rounds.length === 0 ? (
          <div className="pl-slip-empty">{words.connected}</div>
        ) : (
          <div className="pl-slip">
            {rounds.map((round) => (
              <RangeCard
                key={round.roundId.toString()}
                round={round}
                nowMs={nowMs}
                symbol={symbol}
                decimals={decimals}
                staleAfterSec={staleAfterSec}
                busy={writes.busy}
                onClaim={onClaim}
                onSettle={onSettle}
                onVoidStale={onVoidStale}
              />
            ))}
          </div>
        );
      }}
    </ReadingBoundary>
  );
}
