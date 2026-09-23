import { DESK_PRESETS, MANDATE_MAX_TOKENS, nameOf, presetById } from "@agari/core/desk";
import { PRE_IPO_SYMBOLS, type PreIpoSymbol } from "@agari/core/market";
import { SymbolView } from "expo-symbols";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, FadeOut, LinearTransition, useReducedMotion } from "react-native-reanimated";
import { DESK } from "@/features/desk/copy";
import { draftFromPreset, draftTotalBps, type StudioDraft } from "@/features/desk/draft";
import { STUDIO } from "@/features/desk/studio/copy-studio";
import { addName, chosenOf, evenSplit, matchingPreset, pctLabel, removeName } from "@/features/desk/studio/studio-model";
import { Button, haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { TUsdcMark } from "~/components/marks/TUsdcMark";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { Donut, PartitionBar, segColor, Slider } from "../kit";
import { keepLimits } from "./BasketChoice";
import { mixLabel, slicesOf } from "./slices";

const W = STUDIO.weights;
const B = DESK.studio.basket;

/** "Reset to basket" goes back to the preset the draft started from, or the closest one for a mix of your own. */
function presetIdFor(d: StudioDraft): string {
  if (d.preset && presetById(d.preset)) return d.preset;
  const chosen = chosenOf(d);
  const overlap = (id: string) => {
    const members = presetById(id)?.tokens.map((t) => t.symbol) ?? [];
    return members.filter((m) => chosen.includes(m)).length * 100 - Math.abs(members.length - chosen.length);
  };
  return DESK_PRESETS.map((p) => p.id).sort((a, b) => overlap(b) - overlap(a))[0] ?? DESK_PRESETS[0]!.id;
}

/**
 * The weights (web's studio/WeightEditor.tsx): companies added and removed from a logo grid, a slider per chosen
 * one and the cash, the mix drawn as a ring and a bar that warns while the parts do not add up to 100%.
 */
export function WeightEditor({ draft, setDraft }: { draft: StudioDraft; setDraft: (update: (d: StudioDraft) => StudioDraft) => void }) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const chosen = chosenOf(draft);
  const total = draftTotalBps(draft);
  const off = total !== 10_000;
  const slices = slicesOf(draft, color);
  const full = chosen.length >= MANDATE_MAX_TOKENS;
  const update = (fn: (d: StudioDraft) => StudioDraft) =>
    setDraft((d) => {
      const next = fn(d);
      return { ...next, preset: matchingPreset(next) };
    });
  const setWeight = (symbol: PreIpoSymbol, pct: number) => update((d) => ({ ...d, weights: { ...d.weights, [symbol]: Math.round(pct * 100) } }));
  const status = off ? `${total > 10_000 ? W.over(pctLabel(total - 10_000)) : W.under(pctLabel(10_000 - total))} · ${B.mustAddUp}` : W.exact;

  return (
    <View style={styles.wrap}>
      <View style={styles.mix}>
        <Donut slices={slices} size={132} thickness={13} label={mixLabel(slices)}>
          <Text style={[styles.total, { color: off ? color.loss : color.ink }]}>{pctLabel(total)}</Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{W.allocated}</Text>
        </Donut>
        <View style={styles.mixSide}>
          <PartitionBar slices={slices} height={12} warn={off} label={mixLabel(slices)} />
          {slices
            .filter((s) => s.value > 0)
            .map((s) => (
              <View key={s.id} style={styles.legend}>
                <View style={[styles.swatch, { backgroundColor: s.color }]} />
                <Text style={[TYPE.caption, styles.grow, { color: color.inkSecondary }]} numberOfLines={1}>
                  {s.label}
                </Text>
                <Text style={[TYPE.data, { color: color.ink, fontSize: 12 }]}>{pctLabel(s.value)}</Text>
              </View>
            ))}
        </View>
      </View>
      <Text style={[TYPE.caption, { color: off ? color.loss : color.profit }]} accessibilityRole={off ? "alert" : undefined}>
        {status}
      </Text>
      <View style={styles.row}>
        <Button label={W.even} size="sm" variant="secondary" block={false} style={styles.grow} icon={{ ios: "equal.circle", android: "balance" }} disabled={chosen.length === 0} onPress={() => update((d) => evenSplit(d))} />
        <Button label={W.reset} size="sm" variant="secondary" block={false} style={styles.grow} icon={{ ios: "arrow.counterclockwise", android: "restart_alt" }} onPress={() => setDraft((d) => keepLimits(d, draftFromPreset(presetIdFor(d))))} />
      </View>

      <View style={styles.head}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{W.companies}</Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{W.cap(MANDATE_MAX_TOKENS)}</Text>
      </View>
      <View style={styles.chips} accessibilityLabel={W.companiesAria}>
        {PRE_IPO_SYMBOLS.map((s) => {
          const on = chosen.includes(s);
          return (
            <Pressable
              key={s}
              disabled={!on && full}
              onPress={() => {
                haptic.select();
                update((d) => (on ? removeName(d, s) : addName(d, s)));
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: !on && full }}
              accessibilityLabel={on ? W.remove(nameOf(s)) : W.add(nameOf(s))}
              style={[styles.chip, { borderColor: on ? color.accent : color.hairline, backgroundColor: on ? color.accentWash : color.surface1, opacity: !on && full ? 0.45 : 1 }]}
            >
              <AssetDisc asset={s} size={22} />
              <Text style={[TYPE.caption, { color: color.ink }]}>{nameOf(s)}</Text>
              <SymbolView name={on ? { ios: "xmark", android: "close" } : { ios: "plus", android: "add" }} size={11} tintColor={on ? color.accent : color.inkMuted} />
            </Pressable>
          );
        })}
      </View>

      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{W.title}</Text>
      {chosen.length === 0 ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{W.none}</Text> : null}
      {chosen.map((s) => (
        <Animated.View key={s} layout={reduce ? undefined : LinearTransition} entering={reduce ? undefined : FadeIn} exiting={reduce ? undefined : FadeOut} style={styles.weight}>
          <View style={styles.weightHead}>
            <AssetDisc asset={s} size={24} />
            <Text style={[TYPE.bodyStrong, styles.grow, { color: color.ink }]}>{nameOf(s)}</Text>
            <Pressable onPress={() => update((d) => removeName(d, s))} accessibilityRole="button" accessibilityLabel={W.remove(nameOf(s))} hitSlop={12} style={styles.remove}>
              <SymbolView name={{ ios: "xmark", android: "close" }} size={14} tintColor={color.inkMuted} />
            </Pressable>
          </View>
          <Slider value={(draft.weights[s] ?? 0) / 100} onChange={(v) => setWeight(s, v)} min={0} max={100} step={1} label={W.sliderAria(nameOf(s))} display={pctLabel(draft.weights[s] ?? 0)} tone={segColor(s, color)} />
        </Animated.View>
      ))}
      <View style={styles.weight}>
        <View style={styles.weightHead}>
          <TUsdcMark size={24} />
          <Text style={[TYPE.bodyStrong, styles.grow, { color: color.ink }]}>{B.cash}</Text>
        </View>
        <Slider value={draft.cashBps / 100} onChange={(v) => update((d) => ({ ...d, cashBps: Math.round(v * 100) }))} min={0} max={100} step={1} label={B.cash} display={pctLabel(draft.cashBps)} tone={color.inkMuted} />
      </View>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{B.cashNote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  grow: { flex: 1 },
  mix: { flexDirection: "row", alignItems: "center", gap: 14 },
  mixSide: { flex: 1, gap: 6 },
  total: { fontFamily: FONT.dataStrong, fontSize: 20 },
  legend: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  row: { flexDirection: "row", gap: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 10, borderRadius: RADIUS.full, borderWidth: 1 },
  weight: { gap: 2 },
  weightHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  remove: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
});
