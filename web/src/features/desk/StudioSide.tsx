"use client";

import { nameOf, presetById, type DeskMandate } from "@agari/core/desk";
import { Check, CircleDashed, RefreshCw } from "lucide-react";
import { Donut, NumberTicker, StatusDot } from "@/components/ui/desk-kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { DESK } from "./copy";
import { draftTargets, practiceCashE6, type StudioDraft } from "./draft";
import { usd } from "./format";
import { CASH_COLOR, pctLabel, segColor, slicesOf } from "./studio/studio-model";

const S = DESK.studio.side;

/** Display only: a share of the practice balance as dollars for the rolling figures. */
const dollars = (cashE6: bigint, bps: number): number => Number((cashE6 * BigInt(bps)) / 10_000n) / 1_000_000;

/**
 * The studio's side card (plan §5.4, redesigned in S22): the mix as a ring with the practice balance in the middle,
 * one row per company with its logo, share and rolling dollar amount, then the money limits, the mode and the test
 * read's standing. It follows every edit.
 */
export function StudioSide({ draft, mandate, read }: { draft: StudioDraft; mandate: DeskMandate | null; read: "done" | "stale" | "none" }) {
  const targets = draftTargets(draft);
  const preset = draft.preset ? presetById(draft.preset) : null;
  const cash = practiceCashE6(draft);
  const slices = slicesOf(draft).filter((s) => s.value > 0);
  return (
    <aside className="dk-panel dk-studio-side st-side" aria-label={S.kicker}>
      <span className="dk-panel-title">{S.kicker}</span>
      <div className="st-side-head">
        {preset ? <AssetDisc asset={preset.basket} className="st-side-disc" /> : null}
        <h3 className="st-side-name">{preset ? S.preset(preset.name) : S.own}</h3>
      </div>
      <div className="st-side-ring">
        <Donut slices={slices} size={168} thickness={12} label={slices.map((s) => `${s.label} ${pctLabel(s.value)}`).join(", ")}>
          <span className="st-side-total">$<NumberTicker value={Number(cash) / 1_000_000} format="plain" decimals={0} /></span>
          <span className="st-mix-caption">{DESK.modes.practice}</span>
        </Donut>
      </div>
      <ul className="st-side-rows">
        {targets.tokens.map((t) => (
          <li key={t.symbol}>
            <span className="st-side-dot" style={{ background: segColor(t.symbol) }} aria-hidden />
            <AssetDisc asset={t.symbol} className="st-side-mark" />
            <span className="st-side-label">{nameOf(t.symbol)}</span>
            <span className="st-side-pct">{pctLabel(t.weightBps)}</span>
            <span className="st-side-usd">$<NumberTicker value={dollars(cash, t.weightBps)} format="plain" decimals={0} /></span>
          </li>
        ))}
        {targets.cashBps > 0 && (
          <li>
            <span className="st-side-dot" style={{ background: CASH_COLOR }} aria-hidden />
            <span className="st-cash-disc st-side-mark" aria-hidden>$</span>
            <span className="st-side-label">{DESK.studio.basket.cash}</span>
            <span className="st-side-pct">{pctLabel(targets.cashBps)}</span>
            <span className="st-side-usd">$<NumberTicker value={dollars(cash, targets.cashBps)} format="plain" decimals={0} /></span>
          </li>
        )}
      </ul>
      <div className="dk-rows">
        <div className="dk-row"><span>{S.perAction}</span><b>{mandate ? usd(mandate.perActionCapE6, 0) : "—"}</b></div>
        <div className="dk-row"><span>{S.daily}</span><b>{mandate ? usd(mandate.dailyCapE6, 0) : "—"}</b></div>
        <div className="dk-row"><span>{S.mode}</span><StatusDot tone="practice">{DESK.modes.practice}</StatusDot></div>
        <div className="dk-row">
          <span>{S.read}</span>
          <b className="st-read" data-state={read}>
            {read === "done" ? <Check className="size-3.5" aria-hidden /> : read === "stale" ? <RefreshCw className="size-3.5" aria-hidden /> : <CircleDashed className="size-3.5" aria-hidden />}
            {read === "done" ? S.readDone : read === "stale" ? S.readStale : S.readNone}
          </b>
        </div>
      </div>
      <p className="type-caption text-ink-muted">{S.approach}</p>
    </aside>
  );
}
