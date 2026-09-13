"use client";

import type { MarketId } from "@masayume/core/types";
import { shortHex } from "@masayume/core/units";
import { SectionHeader } from "@/components/chrome";
import { ReceiptRow } from "@/components/receipt";
import { ClaimPlate, ClaimSuccessReceipt, IDLE_RUN, LiveClaimPlate } from "@/features/markets/claims";
import { CLAIM } from "@/lib/copy";
import { BATCH_ROWS, DECIMALS, DONE_RUN, FIXED_NOW_MS, IDLE_ROWS, MID_RUN, ORACLE_QUESTION_ID, ORACLE_URL, SETTLEMENT_TX_URL } from "./fixtures";

const noop = () => undefined;

function cannedProofRows(marketId: MarketId) {
  return (
    <>
      <ReceiptRow label={CLAIM.receipt.settlement} href={SETTLEMENT_TX_URL}>
        {shortHex(marketId)}
      </ReceiptRow>
      <ReceiptRow label={CLAIM.receipt.oracle} href={ORACLE_URL}>
        {`#${ORACLE_QUESTION_ID}`}
      </ReceiptRow>
    </>
  );
}

/** Every claim state from canned data (no wallet), then the live plate for whoever is connected. */
export default function DevClaimsPage() {
  return (
    <div className="mx-auto flex w-full max-w-(--content-reading) flex-col gap-10 px-gutter py-8">
      <div className="flex flex-col gap-2">
        <SectionHeader index="00" title={CLAIM.dev.title} />
        <p className="type-body text-ink-secondary">{CLAIM.dev.intro}</p>
      </div>

      <section className="flex flex-col gap-4">
        <SectionHeader index="01" title={CLAIM.dev.plate} />
        <ClaimPlate rows={IDLE_ROWS} decimals={DECIMALS} run={IDLE_RUN} blocker={null} onClaimAll={noop} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="02" title={CLAIM.dev.progress} />
        <ClaimPlate rows={BATCH_ROWS} decimals={DECIMALS} run={MID_RUN} blocker="placing" onClaimAll={noop} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="03" title={CLAIM.dev.receipt} />
        <ClaimSuccessReceipt items={DONE_RUN.items} decimals={DECIMALS} finishedAtMs={FIXED_NOW_MS} marketRows={cannedProofRows} />
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeader index="04" title={CLAIM.dev.live} />
        <LiveClaimPlate />
      </section>
    </div>
  );
}
