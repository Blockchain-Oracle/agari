import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { DESK } from "@/features/desk/copy";
import { ago, pctSigned, usd, usdSigned } from "@/features/desk/format";
import { seriesInRange, type ChartRange } from "@/features/desk/view";
import type { NativeDeskView as DeskView } from "../native-view";
import { Segmented } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { AreaChart, Panel } from "../kit";

const RANGES: readonly ChartRange[] = ["1d", "1w", "all"];
/** Floats only at the display edge: a dollar figure for the canvas. */
const dollars = (e6: bigint): number => Number(e6) / 1_000_000;
const tone = (e6: bigint | null): "up" | "down" | "flat" => (e6 === null || e6 === 0n ? "flat" : e6 > 0n ? "up" : "down");

/**
 * The plate (web's cockpit/ValueHero.tsx, 21st Portfolio Chart #29532): the total, the move since the money went
 * in, the value at every check with 1D · 1W · All, the timing line and when it was valued.
 */
export function ValueHero({ view, nowSec }: { view: DeskView; nowSec: number }) {
  const { color } = useTheme();
  const P = DESK.page.plate;
  const H = COCKPIT.hero;
  const { plate } = view;
  const [range, setRange] = useState<ChartRange>("all");
  const inRange = useMemo(() => seriesInRange(view.series, range, nowSec), [view.series, range, nowSec]);
  const points = useMemo(() => inRange.points.map((p) => ({ timeSec: p.atSec, value: dollars(p.totalE6) })), [inRange.points]);
  const baseline = view.wire.snapshot?.baselineE6 ? dollars(BigInt(view.wire.snapshot.baselineE6)) : null;
  const ink = (t: "up" | "down" | "flat") => (t === "up" ? color.profit : t === "down" ? color.loss : color.inkSecondary);

  if (plate.totalE6 === null) {
    return (
      <Panel title={P.title}>
        <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{H.emptyTitle}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{P.notYet}</Text>
        {!view.isLive ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{P.practiceCash(usd(plate.cashE6))}</Text> : null}
      </Panel>
    );
  }
  return (
    <Panel title={P.total}>
      <Text style={[TYPE.dataHero, { color: color.ink }]} accessibilityLabel={`${P.total} ${usd(plate.totalE6)}`}>
        {usd(plate.totalE6)}
      </Text>
      <View style={styles.moves}>
        {plate.sinceE6 !== null ? (
          <Text style={[TYPE.data, { color: ink(tone(plate.sinceE6)) }]}>
            {usdSigned(plate.sinceE6)} <Text style={[TYPE.caption, { color: color.inkMuted }]}>{P.since.toLowerCase()}</Text>
          </Text>
        ) : null}
        {inRange.deltaE6 !== null && inRange.bps !== null ? (
          <Text style={[TYPE.data, { color: ink(tone(inRange.deltaE6)) }]}>
            {pctSigned(inRange.bps)} <Text style={[TYPE.caption, { color: color.inkMuted }]}>{H.rangeMove[range]}</Text>
          </Text>
        ) : null}
      </View>
      <Segmented label={H.rangesAria} value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r, label: H.ranges[r] }))} />
      {points.length >= 2 ? (
        <AreaChart points={points} baseline={baseline} tone={tone(inRange.deltaE6)} label={H.chartAria} />
      ) : (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{H.oneCheck}</Text>
      )}
      <View style={[styles.foot, { borderTopColor: color.hairline }]}>
        <View style={styles.stat}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{P.timing}</Text>
          <Text style={[TYPE.dataLg, { color: plate.timing.graded === 0 ? color.inkMuted : plate.timing.bps >= 0 ? color.profit : color.loss }]}>
            {plate.timing.graded === 0 ? "—" : pctSigned(plate.timing.bps)}
          </Text>
        </View>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>
          {plate.timing.graded === 0 ? P.timingNone : `${P.timingValue(pctSigned(plate.timing.bps), plate.timing.graded)}. ${P.timingNote}`}
          {plate.valuedAtSec !== null ? ` ${P.valued(ago(plate.valuedAtSec, nowSec))}` : ""}
        </Text>
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  moves: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 4 },
  foot: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 6 },
  stat: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
});
