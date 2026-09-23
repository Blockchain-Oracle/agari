import type { EdgeWindow, TraderEdge } from "@agari/core/projection";
import { formatBaseUnits } from "@agari/core/units";
import { StyleSheet, Text, View } from "react-native";
import { EDGE } from "@/features/edge/copy";
import { signedMoney, toneOf, type Tone } from "@/features/edge/format";
import { Card, Row, Rows, SectionHeader } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

const MIN_BAR_PCT = 4;

function Metric({ label, value, note, tone }: { label: string; value: string; note: string; tone?: Tone }) {
  const { color } = useTheme();
  const ink = tone === "gain" ? color.profit : tone === "loss" ? color.loss : color.ink;
  return (
    <View style={[styles.metric, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessible accessibilityLabel={`${label}: ${value}. ${note}`}>
      <Text style={[styles.label, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{note}</Text>
    </View>
  );
}

/** web's `EdgeMetrics`: four figures two by two, each with the sentence that says what it is measured over. */
export function EdgeMetrics({ report, decimals, symbol }: { report: TraderEdge; decimals: number; symbol: string }) {
  const m = EDGE.report.metrics;
  return (
    <View style={styles.grid}>
      <Metric label={m.winRate.label} value={report.winRatePct === null ? m.winRate.unset : `${report.winRatePct.toFixed(0)}%`} note={m.winRate.note(report.wins, report.losses)} />
      <Metric label={m.profitFactor.label} value={report.profitFactor === null ? m.profitFactor.noLoss : report.profitFactor.toFixed(2)} note={m.profitFactor.note} />
      <Metric
        label={m.expectancy.label}
        value={report.expectancyBase === null ? m.expectancy.unset : signedMoney(report.expectancyBase, decimals, symbol)}
        note={m.expectancy.note}
        tone={report.expectancyBase === null ? undefined : toneOf(report.expectancyBase)}
      />
      <Metric label={m.drawdown.label} value={formatBaseUnits(report.maxDrawdownBase, decimals)} note={m.drawdown.note(symbol)} />
    </View>
  );
}

function WindowRow({ window, maxAbs, decimals, symbol }: { window: EdgeWindow; maxAbs: bigint; decimals: number; symbol: string }) {
  const { color } = useTheme();
  const words = EDGE.report.windows;
  const positive = window.netBase >= 0n;
  const abs = window.netBase < 0n ? -window.netBase : window.netBase;
  const pct = window.count === 0 ? 0 : Math.max(MIN_BAR_PCT, Number((abs * 100n) / maxAbs));
  const label = words.labels[window.key];
  const net = window.count === 0 ? words.none : signedMoney(window.netBase, decimals, symbol);
  return (
    <View style={styles.windowRow} accessible accessibilityLabel={`${label.label}, ${label.range}: ${net}, ${words.rounds(window.count)}`}>
      <View style={styles.windowHead}>
        <View>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{label.label}</Text>
          <Text style={[styles.range, { color: color.inkMuted }]}>{label.range}</Text>
        </View>
        <View style={styles.windowResult}>
          <Text style={[TYPE.data, { color: window.count === 0 ? color.inkMuted : positive ? color.profit : color.loss }]}>{net}</Text>
          <Text style={[styles.range, { color: color.inkMuted }]}>{words.rounds(window.count)}</Text>
        </View>
      </View>
      <View style={styles.split}>
        <View style={styles.half}>
          {!positive && window.count > 0 ? <View style={[styles.bar, styles.barLeft, { width: `${pct}%`, backgroundColor: color.loss }]} /> : null}
        </View>
        <View style={[styles.zero, { backgroundColor: color.borderStrong }]} />
        <View style={styles.half}>{positive && window.count > 0 ? <View style={[styles.bar, { width: `${pct}%`, backgroundColor: color.profit }]} /> : null}</View>
      </View>
    </View>
  );
}

/** web's `EdgeWindows`: split bars by ET session hour — losses grow left from the zero rule, gains grow right. */
export function EdgeWindows({ windows, decimals, symbol }: { windows: readonly EdgeWindow[]; decimals: number; symbol: string }) {
  const { color } = useTheme();
  const words = EDGE.report.windows;
  const timed = windows.reduce((sum, w) => sum + w.count, 0);
  const maxAbs = windows.reduce((max, w) => {
    const abs = w.netBase < 0n ? -w.netBase : w.netBase;
    return abs > max ? abs : max;
  }, 1n);
  return (
    <View style={styles.section}>
      <SectionHeader index="03" title={words.title} desc={words.copy} />
      {timed === 0 ? (
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{words.unreadable}</Text>
      ) : (
        windows.map((w) => <WindowRow key={w.key} window={w} maxAbs={maxAbs} decimals={decimals} symbol={symbol} />)
      )}
    </View>
  );
}

/** web's `EdgePayoff`: the shape of the payoff, and where every number came from. */
export function EdgePayoff({ report, decimals, symbol }: { report: TraderEdge; decimals: number; symbol: string }) {
  const { color } = useTheme();
  const words = EDGE.report.payoff;
  const money = (value: bigint) => `${formatBaseUnits(value, decimals)} ${symbol}`;
  return (
    <View style={styles.section}>
      <SectionHeader index="04" title={words.title} />
      <Rows>
        <Row label={words.averageWin} value={report.averageWinBase === null ? words.noWins : `+${money(report.averageWinBase)}`} tone={report.averageWinBase === null ? "muted" : "profit"} />
        <Row label={words.averageLoss} value={report.averageLossBase === null ? words.noLosses : `-${money(report.averageLossBase)}`} tone={report.averageLossBase === null ? "muted" : "loss"} />
        <Row label={words.bestRun} value={words.runs(report.bestWinStreak)} />
        <Row label={words.fees} value={money(report.settlementFeesBase)} />
        <Row label={words.stake} value={money(report.stakeBase)} />
      </Rows>
      <Card tone="cream">
        <Text style={[styles.label, { color: color.creamInk }]}>{words.provenanceLabel}</Text>
        <Text style={[TYPE.caption, { color: color.creamInk }]}>{words.provenance}</Text>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { flexBasis: "47%", flexGrow: 1, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 4 },
  label: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.1, textTransform: "uppercase" },
  metricValue: { fontFamily: FONT.dataStrong, fontSize: 22, lineHeight: 27 },
  windowRow: { gap: 8 },
  windowHead: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  windowResult: { alignItems: "flex-end" },
  range: { fontFamily: FONT.data, fontSize: 11 },
  split: { flexDirection: "row", alignItems: "center", height: 10 },
  half: { flex: 1, height: 8 },
  bar: { height: 8, borderRadius: 2 },
  barLeft: { alignSelf: "flex-end" },
  zero: { width: 1.5, height: 14 },
});
