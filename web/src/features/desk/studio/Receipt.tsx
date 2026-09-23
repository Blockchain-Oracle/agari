"use client";

import { nameOf, presetById, type DeskMandate } from "@agari/core/desk";
import { LogoStack, PartitionBar } from "@/components/ui/desk-kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { DESK } from "../copy";
import { draftTargets, limitSentences, practiceCashE6, type StudioDraft } from "../draft";
import { usd } from "../format";
import { STUDIO } from "./copy-studio";
import { pctLabel, slicesOf } from "./studio-model";

const R = STUDIO.receipt;

/** What you are about to sign (S22): the basket with its logos and split, every limit and who enforces it. */
export function Receipt({ draft, mandate }: { draft: StudioDraft; mandate: DeskMandate }) {
  const targets = draftTargets(draft);
  const preset = draft.preset ? presetById(draft.preset) : null;
  const cash = practiceCashE6(draft);
  const symbols = targets.tokens.map((t) => t.symbol);
  const slices = slicesOf(draft).filter((s) => s.value > 0);
  return (
    <section className="st-receipt" aria-label={R.title}>
      <header className="st-receipt-head">
        {preset ? <AssetDisc asset={preset.basket} className="st-side-disc" /> : <LogoStack symbols={symbols} size="md" names={symbols.map(nameOf)} />}
        <div>
          <span className="st-label">{R.title}</span>
          <h3 className="st-side-name">{preset ? preset.name : DESK.studio.side.own}</h3>
        </div>
        <span className="st-receipt-cash">{usd(cash, 0)}</span>
      </header>
      <div className="st-receipt-section">
        <span className="st-label">{R.split}</span>
        <PartitionBar slices={slices} height={10} label={slices.map((s) => `${s.label} ${pctLabel(s.value)}`).join(", ")} />
        <ul className="st-receipt-split">
          {targets.tokens.map((t) => (
            <li key={t.symbol}>
              <AssetDisc asset={t.symbol} className="st-side-mark" />
              <span>{nameOf(t.symbol)}</span>
              <b>{pctLabel(t.weightBps)}</b>
              <span className="st-receipt-usd">{usd((cash * BigInt(t.weightBps)) / 10_000n, 0)}</span>
            </li>
          ))}
          {targets.cashBps > 0 && (
            <li>
              <span className="st-cash-disc st-side-mark" aria-hidden>$</span>
              <span>{DESK.studio.basket.cash}</span>
              <b>{pctLabel(targets.cashBps)}</b>
              <span className="st-receipt-usd">{usd((cash * BigInt(targets.cashBps)) / 10_000n, 0)}</span>
            </li>
          )}
        </ul>
      </div>
      <div className="st-receipt-section">
        <span className="st-label">{R.limits}</span>
        <ul className="st-receipt-limits">
          {limitSentences(mandate).map((s) => (
            <li key={s.text}>
              <span>{s.text}</span>
              <span className="st-by" data-by={s.by}>{s.by === "program" ? STUDIO.strictness.program : STUDIO.strictness.code}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
