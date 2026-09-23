import { DESK_PRESETS, MANDATE_MAX_TOKENS, nameOf } from "@agari/core/desk";
import { PRE_IPO_SYMBOLS, TICKERS, type PreIpoSymbol } from "@agari/core/market";
import type { Slice } from "@/components/ui/desk-kit";
import type { StudioDraft } from "../draft";

/**
 * Pure helpers for the redesigned studio (S22). Weights stay in basis points exactly as `draft.ts` keeps them; these
 * only decide which companies are chosen, split weight between them and colour the charts.
 */

/** A company's brand colour pulled toward the ink, so the darkest marks (Neuralink, Anduril) still read on the page. */
export const segColor = (symbol: PreIpoSymbol): string => `color-mix(in oklab, ${TICKERS[symbol].brand.hex} 78%, var(--color-ink))`;
export const CASH_COLOR = "var(--color-ink-muted)";

/** The companies in the draft, in registry order; a key held at zero stays chosen until it is removed. */
export const chosenOf = (d: StudioDraft): PreIpoSymbol[] => PRE_IPO_SYMBOLS.filter((s) => d.weights[s] !== undefined);

export function slicesOf(d: StudioDraft): Slice[] {
  const tokens = chosenOf(d).map((s) => ({ id: s, label: nameOf(s), value: d.weights[s] ?? 0, color: segColor(s) }));
  return [...tokens, { id: "cash", label: "Cash", value: d.cashBps, color: CASH_COLOR }];
}

/** `room` basis points split evenly over `names`, the remainder on the first, as core's presets do. */
function split(names: readonly PreIpoSymbol[], room: number): Partial<Record<PreIpoSymbol, number>> {
  if (names.length === 0) return {};
  const each = Math.floor(room / names.length);
  const out: Partial<Record<PreIpoSymbol, number>> = {};
  names.forEach((s, i) => (out[s] = each + (i === 0 ? room - each * names.length : 0)));
  return out;
}

export const evenSplit = (d: StudioDraft): StudioDraft => ({ ...d, preset: null, weights: split(chosenOf(d), Math.max(0, 10_000 - d.cashBps)) });

/** Adding takes whatever is unallocated, or re-splits evenly when nothing is left; the cap is core's eight. */
export function addName(d: StudioDraft, symbol: PreIpoSymbol): StudioDraft {
  const chosen = chosenOf(d);
  if (chosen.includes(symbol) || chosen.length >= MANDATE_MAX_TOKENS) return d;
  const used = chosen.reduce((sum, s) => sum + (d.weights[s] ?? 0), d.cashBps);
  const left = 10_000 - used;
  if (left > 0) return { ...d, preset: null, weights: { ...d.weights, [symbol]: left } };
  return evenSplit({ ...d, weights: { ...d.weights, [symbol]: 0 } });
}

export function removeName(d: StudioDraft, symbol: PreIpoSymbol): StudioDraft {
  const weights = { ...d.weights };
  delete weights[symbol];
  return { ...d, preset: null, weights };
}

/** The preset the draft's weights still match, so an untouched preset keeps its name. */
export function matchingPreset(d: StudioDraft): string | null {
  const chosen = chosenOf(d).filter((s) => (d.weights[s] ?? 0) > 0);
  for (const p of DESK_PRESETS) {
    if (p.cashBps !== d.cashBps || p.tokens.length !== chosen.length) continue;
    if (p.tokens.every((t) => d.weights[t.symbol] === t.weightBps)) return p.id;
  }
  return null;
}

export type Strictness = "careful" | "balanced" | "loose";
export const STRICTNESS: Record<Strictness, Pick<StudioDraft, "driftPct" | "positionPct" | "lossPct" | "premiumPct">> = {
  careful: { driftPct: "3", positionPct: "40", lossPct: "10", premiumPct: "5" },
  balanced: { driftPct: "5", positionPct: "50", lossPct: "15", premiumPct: "10" },
  loose: { driftPct: "8", positionPct: "60", lossPct: "25", premiumPct: "20" },
};

export function strictnessOf(d: StudioDraft): Strictness | null {
  for (const [k, v] of Object.entries(STRICTNESS) as Array<[Strictness, (typeof STRICTNESS)[Strictness]]>) {
    if (Number(d.driftPct) === Number(v.driftPct) && Number(d.positionPct) === Number(v.positionPct) && Number(d.lossPct) === Number(v.lossPct) && Number(d.premiumPct) === Number(v.premiumPct)) return k;
  }
  return null;
}

/** A draft text field as a number for a slider; an unparsable value sits at the slider's floor. */
export const numberOf = (text: string, min: number): number => {
  const n = Number(text.trim());
  return Number.isFinite(n) ? n : min;
};

/** Display only: basis points as "40%" or "33.3%". */
export const pctLabel = (bps: number): string => `${Number.isInteger(bps / 100) ? bps / 100 : (bps / 100).toFixed(1)}%`;
