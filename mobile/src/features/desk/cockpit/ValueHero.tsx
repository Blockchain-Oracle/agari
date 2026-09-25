import { ChartArea } from "lucide-react-native";
import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { DESK } from "@/features/desk/copy";
import { ago, pctSigned, usd, usdSigned } from "@/features/desk/format";
import { seriesInRange, type ChartRange } from "@/features/desk/view";
import { haptic } from "~/components/kit";
import { FONT } from "~/theme";
import type { NativeDeskView as DeskView } from "../native-view";
import { AreaChart, DT, EmptyState, RadialWash, useDeskTheme } from "../kit";

const RANGES: readonly ChartRange[] = ["1d", "1w", "all"];
/** Floats only at the display edge: a dollar figure for the total and the chart. */
const dollars = (e6: bigint): number => Number(e6) / 1_000_000;
const toneOf = (e6: bigint | null): "up" | "down" | "flat" => (e6 === null || e6 === 0n ? "flat" : e6 > 0n ? "up" : "down");
const plain = (v: number): string => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** `.cp-move`: a signed figure in its tone with a quiet label after it. */
function Move({ value, label, tone }: { value: string; label: string; tone: "up" | "down" | "flat" }) {
  const { color } = useDeskTheme();
  const [bg, ink] = tone === "up" ? [color.profitWash, color.profit] : tone === "down" ? [color.lossWash, color.loss] : [color.surface2, color.ink];
  return (
    <View style={[styles.move, { backgroundColor: bg }]}>
      <Text style={[styles.moveValue, { color: ink }]}>{value}</Text>
      <Text style={[styles.moveLabel, { color: color.inkSecondary }]}>{label}</Text>
    </View>
  );
}

/**
 * The plate (web's cockpit/ValueHero.tsx, 21st Portfolio Chart #29532): the total, the move since the money went in and
 * over the chosen range, 1D · 1W · All, the value at every check as an area chart, and the timing figure with when it
 * was valued. A desk not valued yet says so under an empty state.
 */
export function ValueHero({ view, nowSec }: { view: DeskView; nowSec: number }) {
  const { color } = useDeskTheme();
  const P = DESK.page.plate;
  const H = COCKPIT.hero;
  const { plate } = view;
  const [range, setRange] = useState<ChartRange>("all");
  const inRange = useMemo(() => seriesInRange(view.series, range, nowSec), [view.series, range, nowSec]);
  const points = useMemo(() => inRange.points.map((p) => ({ timeSec: p.atSec, value: dollars(p.totalE6) })), [inRange.points]);
  const baseline = view.wire.snapshot?.baselineE6 ? dollars(BigInt(view.wire.snapshot.baselineE6)) : null;
  const card = [styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }];

  if (plate.totalE6 === null) {
    return (
      <View style={card} accessibilityLabel={P.title}>
        <RadialWash color={color.accentWash} radius={15} />
        <Text style={[DT.panelTitle, { color: color.inkMuted }]}>{P.title}</Text>
        <EmptyState icon={ChartArea} title={H.emptyTitle} body={P.notYet} />
        {!view.isLive ? <Text style={[DT.caption, { color: color.inkMuted }]}>{P.practiceCash(usd(plate.cashE6))}</Text> : null}
      </View>
    );
  }
  const graded = plate.timing.graded > 0;
  return (
    <View style={card} accessibilityLabel={P.title}>
      <RadialWash color={color.accentWash} radius={15} />
      <View style={styles.top}>
        <View style={styles.figures}>
          <Text style={[DT.panelTitle, { color: color.inkMuted }]}>{P.total}</Text>
          <Text style={[styles.total, { color: color.ink }]} accessibilityLabel={`$${plain(dollars(plate.totalE6))}`}>
            <Text>$</Text>
            <Text>{plain(dollars(plate.totalE6))}</Text>
          </Text>
          <View style={styles.moves}>
            {plate.sinceE6 !== null ? <Move value={usdSigned(plate.sinceE6)} label={P.since.toLowerCase()} tone={toneOf(plate.sinceE6)} /> : null}
            {inRange.deltaE6 !== null && inRange.bps !== null ? <Move value={pctSigned(inRange.bps)} label={H.rangeMove[range]} tone={toneOf(inRange.deltaE6)} /> : null}
          </View>
        </View>
        <View style={[styles.ranges, { borderColor: color.hairline }]} accessibilityRole="radiogroup" accessibilityLabel={H.rangesAria}>
          {RANGES.map((r) => {
            const on = range === r;
            return (
              <Pressable
                key={r}
                onPress={() => {
                  haptic.select();
                  setRange(r);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                style={[styles.range, on && { backgroundColor: color.accent }]}
              >
                <Text style={[styles.rangeText, { color: on ? color.onAccent : color.inkMuted }]}>{H.ranges[r]}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={styles.chart}>
        {points.length >= 2 ? (
          <AreaChart points={points} baseline={baseline} tone={toneOf(inRange.deltaE6)} label={H.chartAria} />
        ) : (
          <View style={[styles.chartEmpty, { borderColor: color.hairline }]}>
            <Text style={[DT.caption, { color: color.inkMuted }]}>{H.oneCheck}</Text>
          </View>
        )}
      </View>
      <View style={[styles.foot, { borderTopColor: color.hairline }]}>
        <View style={styles.stat}>
          <Text style={[DT.statLabel, { color: color.inkMuted }]}>{P.timing}</Text>
          <Text style={[styles.statValue, { color: graded ? (plate.timing.bps >= 0 ? color.profit : color.loss) : color.ink }]}>{graded ? pctSigned(plate.timing.bps) : "—"}</Text>
        </View>
        <Text style={[DT.caption, styles.footText, { color: color.inkMuted }]}>
          {graded ? `${P.timingValue(pctSigned(plate.timing.bps), plate.timing.graded)}. ${P.timingNote}` : P.timingNone}
          {plate.valuedAtSec !== null ? ` ${P.valued(ago(plate.valuedAtSec, nowSec))}` : ""}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 10, padding: 16, borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  top: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start", justifyContent: "space-between", gap: 12 },
  figures: { gap: 4, flexGrow: 1 },
  total: { fontFamily: FONT.headingHeavy, fontSize: 38, lineHeight: 50, letterSpacing: -1.33, fontVariant: ["tabular-nums"] },
  moves: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  move: { flexDirection: "row", alignItems: "baseline", gap: 6, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 9999 },
  moveValue: { fontFamily: FONT.bodyStrong, fontSize: 13, lineHeight: 20.8 },
  moveLabel: { fontFamily: FONT.bodyMedium, fontSize: 11.5, lineHeight: 18.4 },
  ranges: { flexDirection: "row", gap: 2, padding: 3, borderWidth: 1, borderRadius: 9999 },
  range: { minWidth: 42, paddingVertical: 5, paddingHorizontal: 10, borderRadius: 9999, alignItems: "center" },
  rangeText: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 19.2 },
  chart: { minHeight: 224, marginHorizontal: -8 },
  chartEmpty: { height: 224, alignItems: "center", justifyContent: "center", borderWidth: 1, borderStyle: "dashed", borderRadius: 12 },
  foot: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 8, columnGap: 16, paddingTop: 12, borderTopWidth: 1 },
  stat: { gap: 2 },
  statValue: { fontFamily: FONT.headingHeavy, fontSize: 20, lineHeight: 32, fontVariant: ["tabular-nums"] },
  footText: { flexGrow: 1, flexBasis: 280 },
});
