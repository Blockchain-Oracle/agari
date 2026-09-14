"use client";

import { isOk } from "@agari/core/schemas";
import type { MarketId } from "@agari/core/types";
import { shortHex } from "@agari/core/units";
import { txUrl } from "@agari/core/urls";
import { useMarket, useResolution } from "@agari/markets/react";
import { ReceiptRow } from "@/components/receipt";
import { CLAIM } from "@/lib/copy";
import { webEnv } from "@/lib/env";
import { printSourceText } from "../verdict/print-source";

/** Settlement tx and the signed price source for one Window; a proof not yet linked degrades in place, never disappears (FR-21). */
export function MarketProofRows({ marketId }: { marketId: MarketId }) {
  const reading = useResolution(marketId);
  // The Window's own row is already cached by the verdict and the claimables; it only supplies the print's boundary.
  const market = useMarket(marketId);
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
  // The per-source print proof page (publish time, signers) comes with the proof replay; until then the row names the source.
  const expirySec = market?.ok && market.value ? market.value.expirySec : null;
  const source = printSourceText(resolution, expirySec);
  return (
    <>
      <ReceiptRow label={CLAIM.receipt.settlement} href={settlementHash ? txUrl(settlementHash, webEnv.markets.cluster) : null} degradedLabel={CLAIM.receipt.settlementDegraded}>
        {settlementHash ? shortHex(settlementHash) : shortHex(marketId)}
      </ReceiptRow>
      <ReceiptRow label={CLAIM.receipt.oracle} href={null} degradedLabel={CLAIM.receipt.oracleDegraded}>
        {source ?? shortHex(marketId)}
      </ReceiptRow>
    </>
  );
}
