import { formatCadence } from "@masayume/core/copy";
import { OUTCOME_TO_SIDE, type MarketId } from "@masayume/core/types";
import { txUrl } from "@masayume/core/urls";
import type { ReactNode } from "react";
import { Money } from "@/components/data";
import { Receipt, ReceiptRow } from "@/components/receipt";
import { CLAIM } from "@/lib/copy";
import { confirmedItems, distinctMarketIds, paidTotal } from "./claim-run";
import type { ClaimItem } from "./types";

interface ClaimSuccessReceiptProps {
  items: readonly ClaimItem[];
  decimals: number;
  finishedAtMs: number;
  /** Settlement tx + Oracle Graph rows for one market — live from the port, or canned in fixtures. */
  marketRows: (marketId: MarketId) => ReactNode;
  className?: string;
}

/** The cream stub for what actually landed: one row per redemption with its tx, then the settlement proofs per Window. */
export function ClaimSuccessReceipt({ items, decimals, finishedAtMs, marketRows, className }: ClaimSuccessReceiptProps) {
  const confirmed = confirmedItems(items);
  if (confirmed.length === 0) return null;

  return (
    <Receipt
      title={CLAIM.receipt.title}
      figure={<Money value={paidTotal(confirmed)} decimals={decimals} />}
      figureLabel={CLAIM.receipt.figureLabel}
      settledAtMs={finishedAtMs}
      className={className}
    >
      {confirmed.map((item) => (
        <ReceiptRow key={item.key} label={`${item.asset} · ${formatCadence(item.intervalSec)} · ${CLAIM.leg[OUTCOME_TO_SIDE[item.outcomeIdx]]}`} href={item.txHash ? txUrl(item.txHash) : null}>
          <Money value={item.payoutBase} decimals={item.decimals} />
        </ReceiptRow>
      ))}
      {distinctMarketIds(confirmed).map((marketId) => (
        <div key={marketId} className="flex flex-col gap-2 border-t border-dotted border-cream-hairline pt-2">
          {marketRows(marketId)}
        </div>
      ))}
    </Receipt>
  );
}
