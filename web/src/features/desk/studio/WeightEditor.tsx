"use client";

import { DESK_PRESETS, MANDATE_MAX_TOKENS, nameOf, presetById } from "@agari/core/desk";
import { PRE_IPO_SYMBOLS, type PreIpoSymbol } from "@agari/core/market";
import { Plus, RotateCcw, Scale, X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Donut, NumberTicker, PartitionBar, Slider } from "@/components/ui/desk-kit";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { DESK } from "../copy";
import { draftFromPreset, draftTotalBps, type StudioDraft } from "../draft";
import { STUDIO } from "./copy-studio";
import { addName, CASH_COLOR, chosenOf, evenSplit, matchingPreset, pctLabel, removeName, segColor, slicesOf } from "./studio-model";

const W = STUDIO.weights;
const B = DESK.studio.basket;

/**
 * The weights (S22): companies are added and removed from a logo grid, each chosen one gets a slider, and the mix is
 * drawn twice, as one bar and as a ring with the total in its middle. Only chosen companies have rows. The bar warns
 * while the weights and the cash do not add up to 100%.
 */
export function WeightEditor({ draft, setDraft }: { draft: StudioDraft; setDraft: (update: (d: StudioDraft) => StudioDraft) => void }) {
  const reduce = useReducedMotion();
  const chosen = chosenOf(draft);
  const total = draftTotalBps(draft);
  const off = total !== 10_000;
  const slices = slicesOf(draft);
  const full = chosen.length >= MANDATE_MAX_TOKENS;
  const update = (fn: (d: StudioDraft) => StudioDraft) => setDraft((d) => { const next = fn(d); return { ...next, preset: matchingPreset(next) }; });
  const setWeight = (symbol: PreIpoSymbol, pct: number) => update((d) => ({ ...d, weights: { ...d.weights, [symbol]: Math.round(pct * 100) } }));

  return (
    <div className="st-weights">
      <div className="st-mix">
        <Donut slices={slices} size={148} thickness={14} label={slices.map((s) => `${s.label} ${pctLabel(s.value)}`).join(", ")}>
          <span className="st-mix-total" data-off={off ? "" : undefined}>
            <NumberTicker value={total / 100} format="plain" decimals={Number.isInteger(total / 100) ? 0 : 1} />%
          </span>
          <span className="st-mix-caption">{W.allocated}</span>
        </Donut>
        <div className="st-mix-side">
          <PartitionBar slices={slices} height={14} warn={off} label={slices.map((s) => `${s.label} ${pctLabel(s.value)}`).join(", ")} />
          <ul className="st-legend">
            {slices.filter((s) => s.value > 0).map((s) => (
              <li key={s.id}>
                <span className="st-legend-dot" style={{ background: s.color }} aria-hidden />
                {s.label}
                <b>{pctLabel(s.value)}</b>
              </li>
            ))}
          </ul>
          <p className="st-mix-status" data-off={off ? "" : undefined} role={off ? "alert" : undefined}>
            {off ? (total > 10_000 ? W.over(pctLabel(total - 10_000)) : W.under(pctLabel(10_000 - total))) : W.exact}
            {off && ` · ${B.mustAddUp}`}
          </p>
          <div className="st-mix-actions">
            <button type="button" className="st-pill" onClick={() => update((d) => evenSplit(d))} disabled={chosen.length === 0}>
              <Scale className="size-3.5" aria-hidden /> {W.even}
            </button>
            <button type="button" className="st-pill" onClick={() => setDraft((d) => ({ ...draftFromPreset(presetIdFor(d)), notes: d.notes, practiceCash: d.practiceCash, driftPct: d.driftPct, positionPct: d.positionPct, lossPct: d.lossPct, premiumPct: d.premiumPct, perAction: d.perAction, daily: d.daily, large: d.large, liveMode: d.liveMode }))}>
              <RotateCcw className="size-3.5" aria-hidden /> {W.reset}
            </button>
          </div>
        </div>
      </div>

      <div className="st-block">
        <div className="st-block-head">
          <span className="st-label">{W.companies}</span>
          <span className="st-hint">{W.cap(MANDATE_MAX_TOKENS)}</span>
        </div>
        <div className="st-chips" role="group" aria-label={W.companiesAria}>
          {PRE_IPO_SYMBOLS.map((s) => {
            const on = chosen.includes(s);
            return (
              <button key={s} type="button" className="st-chip" aria-pressed={on} disabled={!on && full} onClick={() => update((d) => (on ? removeName(d, s) : addName(d, s)))} aria-label={on ? W.remove(nameOf(s)) : W.add(nameOf(s))}>
                <AssetDisc asset={s} className="st-chip-disc" />
                <span>{nameOf(s)}</span>
                {on ? <X className="st-chip-icon size-3.5" aria-hidden /> : <Plus className="st-chip-icon size-3.5" aria-hidden />}
            </button>
            );
          })}
        </div>
      </div>

      <div className="st-block">
        <span className="st-label">{W.title}</span>
        {chosen.length === 0 && <p className="st-hint">{W.none}</p>}
        <ul className="st-rows">
          <AnimatePresence initial={false}>
            {chosen.map((s) => (
              <motion.li key={s} className="st-row" layout={!reduce} initial={reduce ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, x: 12 }} transition={{ duration: 0.22 }}>
                <span className="st-row-name">
                  <AssetDisc asset={s} className="st-row-disc" />
                  <span>{nameOf(s)}</span>
                </span>
                <Slider value={(draft.weights[s] ?? 0) / 100} onChange={(v) => setWeight(s, v)} min={0} max={100} step={1} label={W.sliderAria(nameOf(s))} display={pctLabel(draft.weights[s] ?? 0)} tone={segColor(s)} />
                <button type="button" className="st-row-remove" onClick={() => update((d) => removeName(d, s))} aria-label={W.remove(nameOf(s))}>
                  <X className="size-4" aria-hidden />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
          <li className="st-row st-row-cash">
            <span className="st-row-name">
              <span className="st-cash-disc" aria-hidden>$</span>
              <span>{B.cash}</span>
            </span>
            <Slider value={draft.cashBps / 100} onChange={(v) => update((d) => ({ ...d, cashBps: Math.round(v * 100) }))} min={0} max={100} step={1} label={B.cash} display={pctLabel(draft.cashBps)} tone={CASH_COLOR} />
            <span aria-hidden />
          </li>
        </ul>
        <p className="st-hint">{B.cashNote}</p>
      </div>
    </div>
  );
}

/** "Reset to basket" goes back to the preset the draft started from, or the first basket for a mix of your own. */
function presetIdFor(d: StudioDraft): string {
  if (d.preset && presetById(d.preset)) return d.preset;
  const chosen = chosenOf(d);
  const best = DESK_PRESETS.map((p) => p.id).sort((a, b) => overlap(b, chosen) - overlap(a, chosen))[0];
  return best ?? DESK_PRESETS[0]!.id;
}
const overlap = (id: string, chosen: readonly PreIpoSymbol[]): number => {
  const p = presetById(id);
  if (!p) return 0;
  const members = p.tokens.map((t) => t.symbol);
  return members.filter((m) => chosen.includes(m)).length * 100 - Math.abs(members.length - chosen.length);
};
