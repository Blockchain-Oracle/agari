import type { Verdict } from "@masayume/core/types";
import { Money } from "@/components/data";
import { VERDICT_UI } from "@/lib/copy";
import { cn } from "@/lib/utils";

interface PnlFigureProps {
  verdict: Verdict;
  symbol: string;
  className?: string;
}

/** The one figure allowed profit/loss ink on the screen; without an entry cost on record it reads as a payout. */
export function PnlFigure({ verdict, symbol, className }: PnlFigureProps) {
  const costKnown = verdict.costBasisBase !== null;
  return (
    <div className={cn("flex flex-col items-end gap-1 text-right", className)}>
      <span className="type-label-micro text-ink-muted">{costKnown ? VERDICT_UI.netPnl : VERDICT_UI.paidOut}</span>
      <Money value={verdict.pnlBase} decimals={verdict.decimals} symbol={symbol} tone="pnl" className="type-data-hero" />
      {!costKnown && <span className="type-caption text-ink-muted">{VERDICT_UI.costUnknown}</span>}
    </div>
  );
}
