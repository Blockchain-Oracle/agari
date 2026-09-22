import { checkMandate, DEFAULT_LIMITS, DEFAULT_MONEY, DEFAULT_PRACTICE_CASH_E6, DESK_PRESETS, describeTargets, nameOf, presetById, thresholdBps, type DeskMandate, type DeskTargets } from "@agari/core/desk";
import { BASKETS, isBasketSymbol, PRE_IPO_SYMBOLS, type PreIpoSymbol } from "@agari/core/market";
import { parseDecimalToBaseUnits } from "@agari/core/units";
import { DESK } from "./copy";
import { pct, usd } from "./format";

/**
 * The studio's draft (plan §5.4): weights in basis points, the limits as the text the owner typed, and the way back
 * and forth to a `DeskMandate`. Kept in this browser per owner so a closed tab loses nothing; signed only at the end.
 */
export interface StudioDraft {
  preset: string | null;
  weights: Partial<Record<PreIpoSymbol, number>>;
  cashBps: number;
  driftPct: string;
  positionPct: string;
  lossPct: string;
  premiumPct: string;
  perAction: string;
  daily: string;
  large: string;
  notes: string;
  practiceCash: string;
  liveMode: "ask_first" | "on_its_own";
}

const bpsToPct = (bps: number): string => String(bps / 100);
const pctToBps = (text: string): number | null => {
  const n = Number(text.trim());
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) : null;
};
const usdcText = (e6: bigint): string => (e6 / 1_000_000n).toString();

export function draftFromPreset(id: string): StudioDraft {
  const preset = presetById(id) ?? DESK_PRESETS[0]!;
  return {
    preset: preset.id,
    weights: Object.fromEntries(preset.tokens.map((t) => [t.symbol, t.weightBps])),
    cashBps: preset.cashBps,
    driftPct: bpsToPct(DEFAULT_LIMITS.driftToleranceBps),
    positionPct: bpsToPct(DEFAULT_LIMITS.maxPositionBps),
    lossPct: bpsToPct(DEFAULT_LIMITS.lossStopBps),
    premiumPct: bpsToPct(DEFAULT_LIMITS.maxPremiumBps),
    perAction: usdcText(DEFAULT_MONEY.perActionCapE6),
    daily: usdcText(DEFAULT_MONEY.dailyCapE6),
    large: usdcText(DEFAULT_MONEY.largeActionE6),
    notes: "",
    practiceCash: usdcText(DEFAULT_PRACTICE_CASH_E6),
    liveMode: "ask_first",
  };
}

/** `?basket=AILABS` from /baskets (or a preset id) picks the starting basket; anything else starts on the first preset. */
export function initialDraft(basketParam: string | null | undefined): StudioDraft {
  if (basketParam && isBasketSymbol(basketParam)) return draftFromPreset(BASKETS[basketParam].brand.slug);
  return draftFromPreset(basketParam && presetById(basketParam) ? basketParam : DESK_PRESETS[0]!.id);
}

export function draftFromMandate(m: DeskMandate, practiceCash = usdcText(DEFAULT_PRACTICE_CASH_E6)): StudioDraft {
  return {
    preset: m.preset,
    weights: Object.fromEntries(m.targets.tokens.map((t) => [t.symbol, t.weightBps])),
    cashBps: m.targets.cashBps,
    driftPct: bpsToPct(m.driftToleranceBps),
    positionPct: bpsToPct(m.maxPositionBps),
    lossPct: bpsToPct(m.lossStopBps),
    premiumPct: bpsToPct(m.maxPremiumBps),
    perAction: usdcText(m.perActionCapE6),
    daily: usdcText(m.dailyCapE6),
    large: usdcText(m.largeActionE6),
    notes: m.notes,
    practiceCash,
    liveMode: "ask_first",
  };
}

export const draftTargets = (d: StudioDraft): DeskTargets => ({
  cashBps: d.cashBps,
  tokens: PRE_IPO_SYMBOLS.flatMap((symbol) => {
    const weightBps = d.weights[symbol] ?? 0;
    return weightBps > 0 ? [{ symbol, weightBps }] : [];
  }),
});
export const draftTotalBps = (d: StudioDraft): number => draftTargets(d).tokens.reduce((sum, t) => sum + t.weightBps, d.cashBps);

export type DraftResult = { ok: true; mandate: DeskMandate } | { ok: false; problems: string[] };

/** The mandate the draft describes, or every reason it does not hold together, in plain words. */
export function draftToMandate(d: StudioDraft): DraftResult {
  const problems: string[] = [];
  const bps = (text: string, what: string) => {
    const value = pctToBps(text);
    if (value === null) problems.push(`${what} must be a percentage between 0 and 100`);
    return value ?? 0;
  };
  const money = (text: string, what: string) => {
    const value = parseDecimalToBaseUnits(text, 6);
    if (value === null || value <= 0n) problems.push(`${what} must be a positive amount in USDC`);
    return value ?? 1n;
  };
  const mandate: DeskMandate = {
    preset: d.preset,
    targets: draftTargets(d),
    driftToleranceBps: bps(d.driftPct, "the drift tolerance"),
    maxPositionBps: bps(d.positionPct, "the largest holding"),
    lossStopBps: bps(d.lossPct, "the loss stop"),
    maxPremiumBps: bps(d.premiumPct, "the premium ceiling"),
    perActionCapE6: money(d.perAction, "the per-action limit"),
    dailyCapE6: money(d.daily, "the daily limit"),
    largeActionE6: money(d.large, "the ask-first size"),
    notes: d.notes.trim(),
  };
  if (problems.length > 0) return { ok: false, problems };
  const held = checkMandate(mandate);
  return held.length === 0 ? { ok: true, mandate } : { ok: false, problems: held };
}

/** A stable key for "did the draft change since the test read"; the notes count, the practice balance does not. */
export const draftKey = (d: StudioDraft): string => JSON.stringify({ ...d, practiceCash: undefined, liveMode: undefined });

export const practiceCashE6 = (d: StudioDraft): bigint => parseDecimalToBaseUnits(d.practiceCash, 6) ?? DEFAULT_PRACTICE_CASH_E6;

/** The side card's line: "$1,000 → $400 OpenAI · $400 Anthropic · $200 cash". */
export function sideCardLine(targets: DeskTargets, cashE6: bigint): string {
  const parts = targets.tokens.map((t) => `${usd((cashE6 * BigInt(t.weightBps)) / 10_000n, 0)} ${nameOf(t.symbol)}`);
  if (targets.cashBps > 0) parts.push(`${usd((cashE6 * BigInt(targets.cashBps)) / 10_000n, 0)} cash`);
  return DESK.studio.basket.side(usd(cashE6, 0), parts.join(" · "));
}

/** The limits as the sentences the studio and the mandate panel show, with who enforces each (plan §5.4 step 02). */
export function limitSentences(m: DeskMandate): Array<{ text: string; by: "program" | "code" }> {
  const L = DESK.studio.limits;
  return [
    { text: L.drift(pct(m.driftToleranceBps)), by: "code" },
    { text: L.position(pct(m.maxPositionBps)), by: "code" },
    { text: L.perAction(usd(m.perActionCapE6, 0)), by: "program" },
    { text: L.daily(usd(m.dailyCapE6, 0)), by: "program" },
    { text: L.premium(pct(m.maxPremiumBps)), by: "program" },
    { text: L.loss(pct(m.lossStopBps)), by: "code" },
    { text: L.large(usd(m.largeActionE6, 0)), by: "code" },
  ];
}

/** "Here is how I understood you": the mandate read back in the desk's own words, one sentence per fact. */
export function readBack(m: DeskMandate): string[] {
  const lines = [
    `You want to hold ${describeTargets(m.targets)}.`,
    `I may let a holding wander ${pct(Math.max(m.driftToleranceBps, thresholdBps(m)))} before I act, and I never make a company more than ${pct(m.maxPositionBps)} of the desk.`,
    `I spend at most ${usd(m.perActionCapE6, 0)} in one action and ${usd(m.dailyCapE6, 0)} in a day; the program refuses anything past that.`,
    `I never buy a company more than ${pct(m.maxPremiumBps)} above its mark, and I stop everything if the desk falls ${pct(m.lossStopBps)} below its baseline.`,
    `Above ${usd(m.largeActionE6, 0)} I ask you first, whatever the mode.`,
  ];
  if (m.notes.length > 0) lines.push(`Your note shapes when I act, never how much: “${m.notes.length > 140 ? `${m.notes.slice(0, 140)}…` : m.notes}”.`);
  return lines;
}

export const draftStorageKey = (owner: string | null): string => `agari.desk.draft:101:${owner ?? "anon"}`;
