import type { EdgeWindow, TraderEdge } from "@agari/core/projection";
import { formatBaseUnits } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { EDGE } from "@/features/edge/copy";
import { signedMoney, toneOf, type Tone } from "@/features/edge/format";
import { FONT } from "~/theme";
import { EdgeEnter } from "./EdgeState";
import { useEdgeInk } from "./useEdgeInk";

const MIN_BAR_PCT = 4;

function Metric({ label, value, note, tone, index }: { label: string; value: string; note: string; tone?: Tone; index: number }) {
  const { edge, toneInk } = useEdgeInk();
  // Two by two at phone width: the right column gets the left rule, the second row the top rule.
  const rules = { borderLeftWidth: index % 2 === 1 ? 1 : 0, borderTopWidth: index >= 2 ? 1 : 0, borderColor: edge.rule };
  return (
    <View style={[styles.metric, rules]} accessible accessibilityLabel={`${label}: ${value}. ${note}`}>
      <Text style={[styles.label, { color: edge.muted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: toneInk(tone === "flat" ? undefined : tone) }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[styles.metricNote, { color: edge.faint }]}>{note}</Text>
    </View>
  );
}

/** web `EdgeMetrics` (`.edge-metrics`): four figures in one ruled paper box, two by two on a phone. */
export function EdgeMetrics({ report, decimals, symbol }: { report: TraderEdge; decimals: number; symbol: string }) {
  const { edge } = useEdgeInk();
  const m = EDGE.report.metrics;
  return (
    <EdgeEnter>
      <View style={[styles.metrics, { borderColor: edge.rule, backgroundColor: edge.paper }]} accessibilityLabel="Performance metrics">
        <Metric index={0} label={m.winRate.label} value={report.winRatePct === null ? m.winRate.unset : `${report.winRatePct.toFixed(0)}%`} note={m.winRate.note(report.wins, report.losses)} />
        <Metric index={1} label={m.profitFactor.label} value={report.profitFactor === null ? m.profitFactor.noLoss : report.profitFactor.toFixed(2)} note={m.profitFactor.note} />
        <Metric
          index={2}
          label={m.expectancy.label}
          value={report.expectancyBase === null ? m.expectancy.unset : signedMoney(report.expectancyBase, decimals, symbol)}
          note={m.expectancy.note}
          tone={report.expectancyBase === null ? undefined : toneOf(report.expectancyBase)}
        />
        <Metric index={3} label={m.drawdown.label} value={formatBaseUnits(report.maxDrawdownBase, decimals)} note={m.drawdown.note(symbol)} />
      </View>
    </EdgeEnter>
  );
}

function WindowRow({ window, maxAbs, decimals, symbol }: { window: EdgeWindow; maxAbs: bigint; decimals: number; symbol: string }) {
  const { edge, profit, loss } = useEdgeInk();
  const words = EDGE.report.windows;
  const positive = window.netBase >= 0n;
  const abs = window.netBase < 0n ? -window.netBase : window.netBase;
  const pct = window.count === 0 ? 0 : Math.max(MIN_BAR_PCT, Number((abs * 100n) / maxAbs));
  const label = words.labels[window.key];
  const net = window.count === 0 ? words.none : signedMoney(window.netBase, decimals, symbol);
  const netInk = window.count === 0 ? edge.faint : positive ? profit : loss;
  return (
    <View style={[styles.windowRow, { borderBottomColor: edge.rule }]} accessible accessibilityLabel={`${label.label}, ${label.range}: ${net}, ${words.rounds(window.count)}`}>
      <View style={styles.windowName}>
        <Text style={[styles.name, { color: edge.text }]}>{label.label}</Text>
        <Text style={[styles.range, { color: edge.faint }]}>{label.range}</Text>
      </View>
      <View style={styles.split}>
        <View style={[styles.half, styles.halfLeft]}>
          {!positive && window.count > 0 ? <View style={[styles.bar, styles.lossBar, { width: `${pct}%`, backgroundColor: loss }]} /> : null}
        </View>
        <View style={[styles.zero, { backgroundColor: edge.ruleStrong }]} />
        <View style={styles.half}>{positive && window.count > 0 ? <View style={[styles.bar, styles.gainBar, { width: `${pct}%`, backgroundColor: profit }]} /> : null}</View>
      </View>
      <View style={styles.result}>
        <Text style={[styles.net, { color: netInk }]}>{net}</Text>
        <Text style={[styles.count, { color: edge.faint }]}>{words.rounds(window.count)}</Text>
      </View>
    </View>
  );
}

/** web `EdgeWindows`: split bars by ET session hour — losses grow left from the zero rule, gains grow right. */
export function EdgeWindows({ windows, decimals, symbol }: { windows: readonly EdgeWindow[]; decimals: number; symbol: string }) {
  const { edge } = useEdgeInk();
  const words = EDGE.report.windows;
  const timed = windows.reduce((sum, w) => sum + w.count, 0);
  const maxAbs = windows.reduce((max, w) => {
    const abs = w.netBase < 0n ? -w.netBase : w.netBase;
    return abs > max ? abs : max;
  }, 1n);
  return (
    <EdgeEnter>
      <Text style={[styles.sectionTitle, { color: edge.text }]} accessibilityRole="header">
        {words.title}
      </Text>
      <Text style={[styles.sectionCopy, { color: edge.muted }]}>{words.copy}</Text>
      {timed === 0 ? (
        <Text style={[styles.unreadable, { color: edge.muted }]}>{words.unreadable}</Text>
      ) : (
        <View style={[styles.windowList, { borderTopColor: edge.ruleStrong }]}>
          {windows.map((w) => (
            <WindowRow key={w.key} window={w} maxAbs={maxAbs} decimals={decimals} symbol={symbol} />
          ))}
        </View>
      )}
    </EdgeEnter>
  );
}

/** web `EdgePayoff`: the vermilion-topped aside — the payoff's shape, and where every number came from. */
export function EdgePayoff({ report, decimals, symbol }: { report: TraderEdge; decimals: number; symbol: string }) {
  const { edge } = useEdgeInk();
  const words = EDGE.report.payoff;
  const money = (value: bigint) => `${formatBaseUnits(value, decimals)} ${symbol}`;
  const rows: [string, string][] = [
    [words.averageWin, report.averageWinBase === null ? words.noWins : `+${money(report.averageWinBase)}`],
    [words.averageLoss, report.averageLossBase === null ? words.noLosses : `-${money(report.averageLossBase)}`],
    [words.bestRun, words.runs(report.bestWinStreak)],
    [words.fees, money(report.settlementFeesBase)],
    [words.stake, money(report.stakeBase)],
  ];
  return (
    <EdgeEnter>
      <View style={[styles.payoff, { borderTopColor: edge.vermilion }]}>
        <Text style={[styles.sectionTitle, { color: edge.text }]} accessibilityRole="header">
          {words.title}
        </Text>
        <View style={styles.payoffRows}>
          {rows.map(([name, value]) => (
            <View key={name} style={[styles.payoffRow, { borderBottomColor: edge.rule }]}>
              <Text style={[styles.payoffName, { color: edge.muted }]}>{name}</Text>
              <Text style={[styles.payoffValue, { color: edge.text }]}>{value}</Text>
            </View>
          ))}
        </View>
        <View style={[styles.provenance, { borderLeftColor: edge.ruleStrong }]}>
          <Text style={[styles.label, { color: edge.muted }]}>{words.provenanceLabel}</Text>
          <Text style={[styles.provenanceText, { color: edge.faint }]}>{words.provenance}</Text>
        </View>
      </View>
    </EdgeEnter>
  );
}

const styles = StyleSheet.create({
  label: { fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 12.8, letterSpacing: 1.44, textTransform: "uppercase" },
  metrics: { marginTop: 18, flexDirection: "row", flexWrap: "wrap", borderWidth: 1, borderRadius: 3, overflow: "hidden" },
  metric: { width: "50%", minWidth: 0, paddingVertical: 19, paddingHorizontal: 17 },
  metricValue: { marginTop: 10, fontFamily: FONT.dataStrong, fontSize: 24, lineHeight: 31, letterSpacing: -1.2, fontVariant: ["tabular-nums"] },
  metricNote: { marginTop: 7, fontFamily: FONT.body, fontSize: 10, lineHeight: 14.5 },
  sectionTitle: { fontFamily: FONT.headingHeavy, fontSize: 25, lineHeight: 26.5, letterSpacing: -1.375 },
  sectionCopy: { marginTop: 9, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.8 },
  unreadable: { marginTop: 15, fontFamily: FONT.body, fontSize: 12, lineHeight: 20.4 },
  windowList: { marginTop: 26, borderTopWidth: 1 },
  windowRow: { flexDirection: "row", alignItems: "center", gap: 9, minHeight: 68, borderBottomWidth: 1 },
  windowName: { width: 92 },
  name: { fontFamily: FONT.bodyStrong, fontSize: 10.5, lineHeight: 16.8 },
  range: { marginTop: 3, fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 12.8 },
  split: { flex: 1, flexDirection: "row", height: 8 },
  half: { flex: 1, flexDirection: "row", alignItems: "center" },
  halfLeft: { justifyContent: "flex-end" },
  zero: { width: 1 },
  bar: { height: 8, minWidth: 3 },
  gainBar: { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  lossBar: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  result: { width: 78, alignItems: "flex-end" },
  net: { fontFamily: FONT.dataStrong, fontSize: 9, lineHeight: 14.4, fontVariant: ["tabular-nums"], textAlign: "right" },
  count: { marginTop: 3, fontFamily: FONT.dataRegular, fontSize: 7, lineHeight: 11.2 },
  payoff: { borderTopWidth: 2, paddingTop: 22 },
  payoffRows: { marginTop: 24 },
  payoffRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 16, paddingVertical: 14, borderBottomWidth: 1 },
  payoffName: { fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
  payoffValue: { flexShrink: 1, fontFamily: FONT.dataStrong, fontSize: 12, lineHeight: 19.2, fontVariant: ["tabular-nums"], textAlign: "right" },
  provenance: { marginTop: 32, paddingTop: 20, paddingLeft: 24, borderLeftWidth: 1 },
  provenanceText: { marginTop: 9, fontFamily: FONT.body, fontSize: 10, lineHeight: 16.5 },
});
