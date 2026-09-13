import type { Reading } from "@masayume/core/schemas";
import type { BalanceSheet } from "@masayume/core/types";
import type { ReactNode } from "react";
import { ReadingBoundary } from "@/components/states";
import { BalanceSheetPanel } from "./BalanceSheetPanel";

export interface BalancePlateViewProps {
  reading: Reading<BalanceSheet> | null;
  symbol: string | null;
  retry?: () => void;
  panels?: { vault?: ReactNode };
  className?: string;
}

/** Plate over a balance reading: skeleton before the first answer, last-good with its as-of tick when stale, honest error with retry. */
export function BalancePlateView({ reading, symbol, retry, panels, className }: BalancePlateViewProps) {
  return (
    <ReadingBoundary reading={reading} shape="plate" retry={retry} tick={false} className={className}>
      {(sheet, meta) => <BalanceSheetPanel sheet={sheet} symbol={symbol} stale={meta} panels={panels} className={className} />}
    </ReadingBoundary>
  );
}
