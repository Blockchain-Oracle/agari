"use client";

import { OUTCOME_TO_SIDE, type EventMarket, type Hex, type Resolution, type Verdict } from "@masayume/core/types";
import { formatBaseUnits, secToMs, shortHex } from "@masayume/core/units";
import { oracleGraphUrl, txUrl } from "@masayume/core/urls";
import { Money } from "@/components/data";
import { Receipt, ReceiptRow } from "@/components/receipt";
import { oraclePriceText } from "@/features/markets/hero";
import { ShareTradeButton, type TradeCard } from "@/features/share";
import { MARKETS, VERDICT_UI, formatCadence, verdictAnnouncement, verdictStrings } from "@/lib/copy";
import { ClaimWinnings } from "./ClaimWinnings";
import { PnlFigure } from "./PnlFigure";
import { useAnnounceOnce } from "./useAnnounceOnce";
import { VerdictLegs } from "./VerdictLegs";
import { VerdictStamp } from "./VerdictStamp";

export type VerdictMarket = Pick<EventMarket, "marketId" | "asset" | "intervalSec" | "expirySec" | "openingPriceRaw">;

export interface VerdictCardProps {
  verdict: Verdict;
  market: VerdictMarket;
  /** null while the settlement record is still landing; the receipt then shows its proof rows as pending. */
  resolution: Resolution | null;
  symbol: string;
  /** What the fill projection knows and a live verdict does not: the entry tx, and whether the round closed on the book before expiry. */
  provenance?: { entryTxHash?: Hex; closedEarly?: boolean };
}

const SIDE_WORD = { up: MARKETS.up, down: MARKETS.down } as const;

function windowLine(market: VerdictMarket, verdict: Verdict): string {
  const sides = verdict.legs.map((leg) => SIDE_WORD[OUTCOME_TO_SIDE[leg.outcomeIdx]]).join(" + ");
  return `${market.asset} · ${formatCadence(market.intervalSec)} · ${sides}`;
}

/** The share card's input — every field the verdict, the Window and the settlement record already hold. */
function toTradeCard(verdict: Verdict, market: VerdictMarket, resolution: Resolution | null, symbol: string, settledAtMs: number, provenance?: VerdictCardProps["provenance"]): TradeCard {
  return {
    asset: market.asset,
    intervalSec: market.intervalSec,
    sides: verdict.legs.map((leg) => OUTCOME_TO_SIDE[leg.outcomeIdx]),
    outcome: provenance?.closedEarly ? "closed" : verdict.outcome,
    lineRaw: resolution?.openingRaw ?? market.openingPriceRaw,
    closeRaw: resolution?.closingRaw ?? null,
    stakeBase: verdict.costBasisBase,
    payoutBase: verdict.payoutBase,
    pnlBase: verdict.pnlBase,
    decimals: verdict.decimals,
    symbol,
    expirySec: market.expirySec,
    settledAtMs,
    entryTxHash: provenance?.entryTxHash ?? null,
    settlementTxHash: resolution?.settlementTxHash ?? null,
  };
}

/** Settlement as an unambiguous stamped verdict: 正夢 in vermilion, 逆夢 as a fact, 無効 with its reason — and the receipt to audit it (FR-10). */
export function VerdictCard({ verdict, market, resolution, symbol, provenance }: VerdictCardProps) {
  const strings = verdictStrings(verdict.outcome);
  const announced = useAnnounceOnce(verdictAnnouncement(verdict.outcome, `${formatBaseUnits(verdict.pnlBase, verdict.decimals, { signed: true })} ${symbol}`));
  const settledAtMs = verdict.settledAtMs ?? resolution?.settledAtMs ?? secToMs(market.expirySec);
  const settlementTx = resolution?.settlementTxHash ?? null;
  const questionId = resolution?.oracleQuestionId ?? null;

  return (
    <article
      aria-label={`${VERDICT_UI.title}: ${strings.line}`}
      className="flex flex-col gap-5 rounded-(--market-card-radius) border border-(--market-card-border) bg-(--market-card-surface) p-4"
    >
      <span role="status" aria-live="polite" className="sr-only">
        {announced}
      </span>
      <header className="flex items-start justify-between gap-4">
        <VerdictStamp outcome={verdict.outcome} />
        <PnlFigure verdict={verdict} symbol={symbol} />
      </header>
      {verdict.outcome === "void" && <p className="type-body text-ink-secondary">{strings.line}</p>}
      <VerdictLegs legs={verdict.legs} decimals={verdict.decimals} symbol={symbol} />
      {/* The reference's one settled-result card with the claim on it (ClaimWinnings.tsx, mounted from Verdict.tsx L106). */}
      <ClaimWinnings verdict={verdict} marketId={market.marketId} symbol={symbol} />
      <Receipt
        title={VERDICT_UI.receiptTitle}
        figure={<Money value={verdict.payoutBase} decimals={verdict.decimals} symbol={symbol} className="text-cream-ink" />}
        figureLabel={VERDICT_UI.paidOut}
        settledAtMs={settledAtMs}
        stamp={<VerdictStamp outcome={verdict.outcome} size="compact" />}
      >
        <ReceiptRow label={VERDICT_UI.window}>{windowLine(market, verdict)}</ReceiptRow>
        <ReceiptRow label={VERDICT_UI.openingPrint}>{oraclePriceText(resolution?.openingRaw ?? market.openingPriceRaw)}</ReceiptRow>
        <ReceiptRow label={VERDICT_UI.closingPrint}>{oraclePriceText(resolution?.closingRaw ?? null)}</ReceiptRow>
        <ReceiptRow label={VERDICT_UI.settlementTx} href={settlementTx ? txUrl(settlementTx) : null} degradedLabel={VERDICT_UI.pendingTx}>
          {settlementTx ? shortHex(settlementTx, 10, 4) : "—"}
        </ReceiptRow>
        <ReceiptRow label={VERDICT_UI.oracleGraph} href={questionId ? oracleGraphUrl(questionId) : null} degradedLabel={VERDICT_UI.noQuestion}>
          {questionId ? VERDICT_UI.question(questionId) : "—"}
        </ReceiptRow>
      </Receipt>
      {/* The reference's receipt footer share slot (TradeReceipt L321–325): the Earned Heat card, real fields only. */}
      <div className="flex justify-end">
        <ShareTradeButton card={toTradeCard(verdict, market, resolution, symbol, settledAtMs, provenance)} />
      </div>
    </article>
  );
}
