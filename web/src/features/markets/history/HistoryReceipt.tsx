"use client";

import { toVerdict, type SettledRound } from "@masayume/core/projection";
import { isOk } from "@masayume/core/schemas";
import { useMarket, useResolution } from "@masayume/markets/react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { VerdictCard } from "../verdict";
import { HISTORY } from "./copy";

interface HistoryReceiptProps {
  round: SettledRound | null;
  symbol: string;
  onClose: () => void;
}

function ReceiptBody({ round, symbol }: { round: SettledRound; symbol: string }) {
  const market = useMarket(round.marketId);
  const resolution = useResolution(round.marketId);
  const openingPriceRaw = market && isOk(market) ? (market.value?.openingPriceRaw ?? null) : null;
  return (
    <VerdictCard
      verdict={toVerdict(round)}
      market={{ marketId: round.marketId, asset: round.asset, intervalSec: round.intervalSec, expirySec: round.expirySec, openingPriceRaw }}
      resolution={resolution && isOk(resolution) ? resolution.value : null}
      symbol={symbol}
      provenance={{ ...(round.source === "vault" ? {} : { entryTxHash: round.entryTxHash }), closedEarly: round.outcome === "closed" }}
    />
  );
}

/**
 * One open receipt at a time, as the reference's `TradeReceipt` modal: the sheet owns the
 * overlay, Escape and scroll-lock. The card inside is the same Verdict the live window stamps,
 * so a settled row and the moment it settled can never disagree.
 */
export function HistoryReceipt({ round, symbol, onClose }: HistoryReceiptProps) {
  return (
    <Sheet open={round !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="history-receipt-sheet">
        <SheetHeader className="sr-only">
          <SheetTitle>{HISTORY.receiptTitle}</SheetTitle>
          <SheetDescription>{round ? `${round.asset} · ${HISTORY.outcome[round.outcome]}` : ""}</SheetDescription>
        </SheetHeader>
        <div className="history-receipt-scroll">{round && <ReceiptBody key={round.marketId} round={round} symbol={symbol} />}</div>
      </SheetContent>
    </Sheet>
  );
}
