"use client";

import { isOk } from "@masayume/core/schemas";
import type { MarketId } from "@masayume/core/types";
import { shortHex } from "@masayume/core/units";
import { oracleGraphUrl, txUrl } from "@masayume/core/urls";
import { useResolution } from "@masayume/markets/react";
import { ReceiptRow } from "@/components/receipt";
import { CLAIM } from "@/lib/copy";

/** Settlement tx and Oracle Graph for one Window; an unreachable proof degrades in place, never disappears (FR-21). */
export function MarketProofRows({ marketId }: { marketId: MarketId }) {
  const reading = useResolution(marketId);
  if (reading === null) {
    return (
      <>
        <ReceiptRow label={CLAIM.receipt.settlement}>{CLAIM.receipt.pending}</ReceiptRow>
        <ReceiptRow label={CLAIM.receipt.oracle}>{CLAIM.receipt.pending}</ReceiptRow>
      </>
    );
  }
  const resolution = isOk(reading) ? reading.value : null;
  const settlementHash = resolution?.settlementTxHash ?? null;
  const questionId = resolution?.oracleQuestionId ?? null;
  return (
    <>
      <ReceiptRow label={CLAIM.receipt.settlement} href={settlementHash ? txUrl(settlementHash) : null} degradedLabel={CLAIM.receipt.settlementDegraded}>
        {settlementHash ? shortHex(settlementHash) : shortHex(marketId)}
      </ReceiptRow>
      <ReceiptRow label={CLAIM.receipt.oracle} href={questionId ? oracleGraphUrl(questionId) : null} degradedLabel={CLAIM.receipt.oracleDegraded}>
        {questionId ? `#${questionId}` : shortHex(marketId)}
      </ReceiptRow>
    </>
  );
}
