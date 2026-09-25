import { DESK_PRESETS, MANDATE_MAX_TOKENS, nameOf, presetById } from "@agari/core/desk";
import { PRE_IPO_SYMBOLS, type PreIpoSymbol } from "@agari/core/market";
import { Plus, RotateCcw, Scale, X } from "lucide-react-native";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeOut, LinearTransition, useReducedMotion } from "react-native-reanimated";
import { DESK } from "@/features/desk/copy";
import { draftFromPreset, draftTotalBps, type StudioDraft } from "@/features/desk/draft";
import { STUDIO } from "@/features/desk/studio/copy-studio";
import { addName, chosenOf, evenSplit, matchingPreset, pctLabel, removeName } from "@/features/desk/studio/studio-model";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";
import { Donut, PartitionBar, Slider } from "../kit";
import { keepLimits } from "./BasketChoice";
import { CashDisc, DashedRule, StHint, StLabel, StPill, useDeskEntryTokens } from "./kit-bits";
import { slideIn } from "./kit-motion";
import { mixLabel, segColor, slicesOf } from "./slices";

const W = STUDIO.weights;
const B = DESK.studio.basket;
type SetDraft = (update: (d: StudioDraft) => StudioDraft) => void;

/** web's WeightEditor `.st-mix`: the ring with the total, the bar, the legend, the status and the two pills. */
function MixCard({ draft, update, setDraft }: { draft: StudioDraft; update: SetDraft; setDraft: SetDraft }) {
  const { color } = useTheme();
  const total = draftTotalBps(draft);
  const off = total !== 10_000;
  const slices = slicesOf(draft, color);
  const label = mixLabel(slices);
  return (
    <View style={[styles.mix, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <Donut slices={slices} size={148} thickness={14} label={label}>
        <Text style={[styles.mixTotal, { color: off ? color.warning : color.ink }]}>{pctLabel(total)}</Text>
        <Text style={[styles.caption, { color: color.inkMuted }]}>{W.allocated}</Text>
      </Donut>
      <View style={styles.mixSide}>
        <PartitionBar slices={slices} height={14} warn={off} label={label} />
        <View style={styles.legend}>
          {slices
            .filter((s) => s.value > 0)
            .map((s) => (
              <View key={s.id} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: s.color }]} />
                <Text style={[styles.legendText, { color: color.inkSecondary }]}>{s.label}</Text>
                <Text style={[styles.legendPct, { color: color.ink }]}>{pctLabel(s.value)}</Text>
              </View>
            ))}
        </View>
        <Text style={[styles.status, { color: off ? color.warning : color.profit }]} accessibilityRole={off ? "alert" : undefined}>
          {off ? (total > 10_000 ? W.over(pctLabel(total - 10_000)) : W.under(pctLabel(10_000 - total))) : W.exact}
          {off ? ` · ${B.mustAddUp}` : ""}
        </Text>
        <View style={styles.actions}>
          <StPill label={W.even} icon={Scale} onPress={() => update((d) => evenSplit(d))} disabled={chosenOf(draft).length === 0} />
          <StPill label={W.reset} icon={RotateCcw} onPress={() => setDraft((d) => keepLimits(d, draftFromPreset(presetIdFor(d))))} />
        </View>
      </View>
    </View>
  );
}

/**
 * web's studio/WeightEditor.tsx: companies are added and removed from a logo grid, each chosen one gets a slider, and
 * the mix is drawn twice, as one bar and as a ring with the total in its middle. The bar warns while the weights and
 * the cash do not add up to 100%.
 */
export function WeightEditor({ draft, setDraft }: { draft: StudioDraft; setDraft: SetDraft }) {
  const { color } = useTheme();
  const tk = useDeskEntryTokens();
  const reduce = useReducedMotion();
  const chosen = chosenOf(draft);
  const full = chosen.length >= MANDATE_MAX_TOKENS;
  const update: SetDraft = (fn) =>
    setDraft((d) => {
      const next = fn(d);
      return { ...next, preset: matchingPreset(next) };
    });
  const setWeight = (symbol: PreIpoSymbol, pct: number) => update((d) => ({ ...d, weights: { ...d.weights, [symbol]: Math.round(pct * 100) } }));

  return (
    <View style={styles.weights}>
      <MixCard draft={draft} update={update} setDraft={setDraft} />

      <View style={styles.block}>
        <View style={styles.blockHead}>
          <StLabel>{W.companies}</StLabel>
          <StHint>{W.cap(MANDATE_MAX_TOKENS)}</StHint>
        </View>
        <View style={styles.chips} accessibilityLabel={W.companiesAria}>
          {PRE_IPO_SYMBOLS.map((s) => {
            const on = chosen.includes(s);
            const Icon = on ? X : Plus;
            return (
              <Pressable
                key={s}
                disabled={!on && full}
                onPress={() => update((d) => (on ? removeName(d, s) : addName(d, s)))}
                accessibilityRole="button"
                accessibilityState={{ selected: on, disabled: !on && full }}
                accessibilityLabel={on ? W.remove(nameOf(s)) : W.add(nameOf(s))}
                style={[styles.chip, on ? { borderColor: color.accent, backgroundColor: color.accentWash } : { borderColor: tk.chipBorder }, !on && full && styles.chipOff]}
              >
                <AssetDisc asset={s} size={24} />
                <Text style={[styles.chipText, { color: on ? tk.chipInkOn : tk.chipInk }]}>{nameOf(s)}</Text>
                <Icon size={14} color={on ? color.accent : color.inkMuted} />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.block}>
        <StLabel>{W.title}</StLabel>
        {chosen.length === 0 ? <StHint>{W.none}</StHint> : null}
        <View style={styles.rows}>
          {chosen.map((s) => (
            <Animated.View key={s} entering={reduce ? undefined : slideIn({ distance: -6, duration: 220 })} exiting={reduce ? undefined : FadeOut.duration(220)} layout={reduce ? undefined : LinearTransition.duration(220)} style={[styles.row, { borderColor: tk.clear }]}>
              <View style={styles.rowHead}>
                <View style={styles.rowName}>
                  <AssetDisc asset={s} size={30} />
                  <Text style={[styles.rowText, { color: color.ink }]} numberOfLines={1}>
                    {nameOf(s)}
                  </Text>
                </View>
                <Pressable onPress={() => update((d) => removeName(d, s))} accessibilityRole="button" accessibilityLabel={W.remove(nameOf(s))} style={styles.remove} hitSlop={6}>
                  <X size={16} color={color.inkMuted} />
                </Pressable>
              </View>
              <Slider value={(draft.weights[s] ?? 0) / 100} onChange={(v) => setWeight(s, v)} min={0} max={100} step={1} label={W.sliderAria(nameOf(s))} display={pctLabel(draft.weights[s] ?? 0)} tone={segColor(s, color)} />
            </Animated.View>
          ))}
          <View style={styles.cashRow}>
            <DashedRule />
            <View style={[styles.row, styles.cashInner, { borderColor: tk.clear }]}>
              <View style={styles.rowName}>
                <CashDisc />
                <Text style={[styles.rowText, { color: color.ink }]}>{B.cash}</Text>
              </View>
              <Slider value={draft.cashBps / 100} onChange={(v) => update((d) => ({ ...d, cashBps: Math.round(v * 100) }))} min={0} max={100} step={1} label={B.cash} display={pctLabel(draft.cashBps)} tone={color.inkMuted} />
            </View>
          </View>
        </View>
        <StHint>{B.cashNote}</StHint>
      </View>
    </View>
  );
}

/** "Reset to basket" goes back to the preset the draft started from, or the closest basket for a mix of your own. */
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

const styles = StyleSheet.create({
  weights: { gap: 28 },
  mix: { alignItems: "center", gap: 28, padding: 16, borderWidth: 1, borderRadius: 16 },
  mixTotal: { fontFamily: FONT.headingHeavy, fontSize: 26, lineHeight: 41.6, letterSpacing: -0.52 },
  caption: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.2, textTransform: "uppercase" },
  mixSide: { alignSelf: "stretch", gap: 14 },
  legend: { flexDirection: "row", flexWrap: "wrap", rowGap: 6, columnGap: 16 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 3 },
  legendText: { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 20 },
  legendPct: { fontFamily: FONT.dataStrong, fontSize: 12.5, lineHeight: 20 },
  status: { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 20 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  block: { gap: 12 },
  blockHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  chips: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5, paddingLeft: 5, paddingRight: 10, borderRadius: 9999, borderWidth: 1 },
  chipOff: { opacity: 0.4 },
  chipText: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 20.8 },
  rows: { gap: 4 },
  row: { gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  rowName: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  rowText: { flexShrink: 1, fontFamily: FONT.bodyStrong, fontSize: 14, lineHeight: 22.4 },
  remove: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cashRow: { marginTop: 6 },
  cashInner: { paddingTop: 14, borderTopWidth: 0 },
});
