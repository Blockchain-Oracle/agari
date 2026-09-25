import { StyleSheet, Text, View } from "react-native";
import { COCKPIT } from "@/features/desk/cockpit/copy-cockpit";
import { DESK } from "@/features/desk/copy";
import { pct, usd } from "@/features/desk/format";
import { FONT } from "~/theme";
import type { NativeDeskView as DeskView } from "../native-view";
import { DT, Panel, RadialGauge, useDeskTheme } from "../kit";

const O = COCKPIT.overview;
const share = (part: bigint, whole: bigint): number => (whole <= 0n ? 0 : Number((part * 10_000n) / whole) / 100);

/**
 * web's cockpit/LimitGauges.tsx (21st Progress radial #3424): spent today against the daily limit, the highest premium
 * held against the ceiling, the fall from the baseline against the loss stop, three across; then the four limits as
 * figures, two by two.
 */
export function LimitGauges({ view }: { view: DeskView }) {
  const { color } = useDeskTheme();
  const L = DESK.page.limits;
  const { limits, holdings, plate } = view;
  const top = holdings.filter((h) => h.premiumBps !== null).sort((a, b) => (b.premiumBps ?? 0) - (a.premiumBps ?? 0))[0];
  const topBps = top?.premiumBps ?? null;
  const baseline = view.wire.snapshot?.baselineE6 ? BigInt(view.wire.snapshot.baselineE6) : null;
  const downBps = baseline !== null && plate.totalE6 !== null && baseline > 0n && plate.totalE6 < baseline ? Number(((baseline - plate.totalE6) * 10_000n) / baseline) : 0;
  const gauges = [
    { key: "spent", label: L.spentToday, value: share(limits.spentTodayE6, limits.dailyCapE6), center: `${Math.round(share(limits.spentTodayE6, limits.dailyCapE6))}%`, line: L.spentOf(usd(limits.spentTodayE6, 0), usd(limits.dailyCapE6, 0)) },
    {
      key: "premium",
      label: O.premium,
      value: topBps === null || limits.maxPremiumBps <= 0 ? 0 : Math.max(0, (topBps / limits.maxPremiumBps) * 100),
      center: topBps === null ? "—" : pct(topBps),
      line: top && topBps !== null ? `${top.name} · ${O.ceiling(pct(limits.maxPremiumBps))}` : `${O.premiumNone} · ${O.ceiling(pct(limits.maxPremiumBps))}`,
    },
    { key: "loss", label: O.drawdown, value: limits.lossStopBps <= 0 ? 0 : (downBps / limits.lossStopBps) * 100, center: downBps === 0 ? "0%" : pct(downBps), line: `${downBps === 0 ? O.up : O.down(pct(downBps))} · ${O.stopAt(pct(limits.lossStopBps))}` },
  ];
  const figures = [
    [L.perAction, usd(limits.perActionE6, 0)],
    [L.large, usd(limits.largeActionE6, 0)],
    [L.premium, pct(limits.maxPremiumBps)],
    [L.loss, pct(limits.lossStopBps)],
  ] as const;
  return (
    <Panel title={L.title}>
      <View style={styles.gauges}>
        {gauges.map((g) => (
          <View key={g.key} style={styles.gauge}>
            <RadialGauge value={g.value} size={72} stroke={7} label={`${g.label}: ${g.line}`}>
              {g.center}
            </RadialGauge>
            <View style={styles.gaugeText}>
              <Text style={[DT.statLabel, styles.centered, { color: color.inkMuted }]}>{g.label}</Text>
              <Text style={[DT.caption, styles.centered, { color: color.inkSecondary }]}>{g.line}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={styles.figures}>
        {figures.map(([label, value]) => (
          <View key={label} style={[styles.figure, { backgroundColor: color.surface2 }]}>
            <Text style={[DT.statLabel, { color: color.inkMuted }]}>{label}</Text>
            <Text style={[styles.figureValue, { color: color.ink }]}>{value}</Text>
          </View>
        ))}
      </View>
      {!view.isLive ? <Text style={[DT.caption, { color: color.inkMuted }]}>{L.practiceNote}</Text> : null}
    </Panel>
  );
}

const styles = StyleSheet.create({
  gauges: { flexDirection: "row", gap: 14 },
  gauge: { flex: 1, minWidth: 0, alignItems: "center", gap: 10 },
  gaugeText: { gap: 3, alignSelf: "stretch" },
  centered: { textAlign: "center" },
  figures: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  figure: { flexBasis: "47%", flexGrow: 1, gap: 3, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 },
  figureValue: { fontFamily: FONT.headingHeavy, fontSize: 16, lineHeight: 25.6, fontVariant: ["tabular-nums"] },
});
