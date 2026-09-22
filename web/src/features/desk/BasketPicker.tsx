"use client";

import { DESK_PRESETS, MANDATE_MAX_TOKENS, nameOf } from "@agari/core/desk";
import { PRE_IPO_SYMBOLS, type PreIpoSymbol } from "@agari/core/market";
import { AssetDisc } from "@/features/markets/hero/asset-mark";
import { DESK } from "./copy";
import { draftFromPreset, draftTotalBps, type StudioDraft } from "./draft";
import { pct } from "./format";

const B = DESK.studio.basket;

/**
 * Step 01, the basket (plan §5.4): the five presets as cards, then every name's weight and the cash sleeve, editable.
 * Editing a weight keeps the preset's name until the mix no longer matches it. Weights must total 100%.
 */
export function BasketPicker({ draft, setDraft }: { draft: StudioDraft; setDraft: (update: (d: StudioDraft) => StudioDraft) => void }) {
  const total = draftTotalBps(draft);
  const setWeight = (symbol: PreIpoSymbol, text: string) => {
    const n = Number(text);
    const weightBps = Number.isFinite(n) ? Math.max(0, Math.min(10_000, Math.round(n * 100))) : 0;
    setDraft((d) => ({ ...d, preset: null, weights: { ...d.weights, [symbol]: weightBps } }));
  };
  const named = PRE_IPO_SYMBOLS.filter((s) => (draft.weights[s] ?? 0) > 0);
  return (
    <div className="flex flex-col gap-6">
      <div className="dk-field">
        <span>{B.presets}</span>
        <div className="dk-choices" role="group" aria-label={B.presets}>
          {DESK_PRESETS.map((p) => (
            <button key={p.id} type="button" className="dk-choice" aria-pressed={draft.preset === p.id} onClick={() => setDraft((d) => ({ ...draftFromPreset(p.id), notes: d.notes, practiceCash: d.practiceCash, driftPct: d.driftPct, positionPct: d.positionPct, lossPct: d.lossPct, premiumPct: d.premiumPct, perAction: d.perAction, daily: d.daily, large: d.large }))}>
              <span className="dk-choice-title">{p.name}</span>
              <span className="dk-choice-body">{p.description}</span>
            </button>
          ))}
        </div>
      </div>
      <div className="dk-field">
        <span>{B.weights}</span>
        <div className="dk-weights">
          {PRE_IPO_SYMBOLS.map((symbol) => (
            <label key={symbol} className="dk-weight">
              <AssetDisc asset={symbol} className="dk-holding-mark" />
              <span className="dk-weight-name">{nameOf(symbol)}</span>
              <input className="dk-input" inputMode="decimal" aria-label={`${nameOf(symbol)} weight in percent`} value={(draft.weights[symbol] ?? 0) / 100} onChange={(e) => setWeight(symbol, e.target.value)} disabled={(draft.weights[symbol] ?? 0) === 0 && named.length >= MANDATE_MAX_TOKENS} />
            </label>
          ))}
          <label className="dk-weight">
            <span aria-hidden className="dk-holding-mark" />
            <span className="dk-weight-name">{B.cash}</span>
            <input className="dk-input" inputMode="decimal" aria-label="Cash sleeve in percent" value={draft.cashBps / 100} onChange={(e) => setDraft((d) => ({ ...d, preset: null, cashBps: Math.max(0, Math.min(10_000, Math.round((Number(e.target.value) || 0) * 100))) }))} />
          </label>
        </div>
        <p className={total === 10_000 ? "type-caption text-ink-secondary" : "type-caption dk-warn"}>{B.total(pct(total))}{total === 10_000 ? "" : ` · ${B.mustAddUp}`}</p>
        <p className="type-caption text-ink-muted">{B.cashNote}</p>
      </div>
    </div>
  );
}
