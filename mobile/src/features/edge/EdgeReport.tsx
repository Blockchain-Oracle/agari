import type { TraderEdge, WalletHistory } from "@agari/core/projection";
import { StyleSheet, Text, View } from "react-native";
import { EDGE } from "@/features/edge/copy";
import { signedMoney, signedPct, toneOf } from "@/features/edge/format";
import { FONT } from "~/theme";
import { EdgeCurve } from "./EdgeCurve";
import { EdgeMetrics, EdgePayoff, EdgeWindows } from "./EdgeSections";
import { EdgeEnter } from "./EdgeState";
import { useEdgeInk } from "./useEdgeInk";

/** web's `readoutText` (EdgeReport.tsx): the one sentence the record supports. */
function readoutText(report: TraderEdge, decimals: number, symbol: string): string {
  const words = EDGE.report.readout;
  const r = report.readout;
  switch (r.kind) {
    case "more-rounds":
      return words.moreRounds(r.needed);
    case "best-window":
      return words.bestWindow(EDGE.report.windows.labels[r.window.key].label, signedMoney(r.window.netBase, decimals, symbol), r.window.count);
    case "profit-factor":
      return words.profitFactor(r.factor.toFixed(2), symbol);
    case "drawdown":
      return words.drawdown(signedMoney(r.drawdownBase, decimals, symbol).replace(/^\+/, ""));
    case "flat":
      return words.flat;
  }
}

/**
 * web `EdgeReport` (edge-report.css at 402 px): the curve panel with the net figure stacked over its sample line, the
 * readout aside under it, the four metrics two by two, then timing and payoff in one column, and the mono footer.
 */
export function EdgeReport({ history, report, symbol }: { history: WalletHistory; report: TraderEdge; symbol: string }) {
  const { edge, toneInk } = useEdgeInk();
  const { decimals } = history;
  const tone = toneOf(report.netBase);
  const net = signedMoney(report.netBase, decimals);
  const [settledLine, openLine] = EDGE.report.sample(report.settledRounds, report.openRounds);

  return (
    <View style={styles.report}>
      {!history.complete ? <Text style={[styles.partial, { color: edge.muted }]}>{EDGE.states.partial}</Text> : null}
      <EdgeEnter>
        <View style={styles.heroGrid}>
          <View style={[styles.panel, styles.curvePanel, { borderColor: edge.rule, backgroundColor: edge.surface }]} accessibilityLabel={EDGE.report.netLabel}>
            <Text style={[styles.label, { color: edge.muted }]}>{EDGE.report.netLabel}</Text>
            <Text style={[styles.net, { color: toneInk(tone === "flat" ? undefined : tone) }]} accessibilityLabel={`${EDGE.report.netLabel}: ${net} ${symbol}`}>
              {net}
              <Text style={[styles.unit, { color: edge.muted }]}>{`\u0020\u2009${symbol}`}</Text>
            </Text>
            <Text style={[styles.roi, { color: edge.muted }]}>
              {report.roiPct === null ? EDGE.report.roiUnavailable : EDGE.report.roi(signedPct(report.roiPct))}
            </Text>
            <Text style={[styles.sample, { color: edge.faint }]}>
              {settledLine}
              {"\n"}
              {openLine}
            </Text>
            <EdgeCurve points={report.equity} decimals={decimals} tone={tone} label={EDGE.report.chartLabel(`${net} ${symbol}`, report.settledRounds)} />
          </View>

          <View style={[styles.panel, styles.readoutPanel, { borderColor: edge.rule, backgroundColor: edge.surface2 }]}>
            <View>
              <Text style={[styles.label, { color: edge.muted }]}>{EDGE.report.readoutLabel}</Text>
              <Text style={[styles.readout, { color: edge.text }]}>{readoutText(report, decimals, symbol)}</Text>
            </View>
            <Text style={[styles.readoutFoot, { color: edge.faint }]}>{EDGE.report.readoutFoot}</Text>
          </View>
        </View>
      </EdgeEnter>

      <EdgeMetrics report={report} decimals={decimals} symbol={symbol} />

      <View style={styles.lowerGrid}>
        <EdgeWindows windows={report.windows} decimals={decimals} symbol={symbol} />
        <EdgePayoff report={report} decimals={decimals} symbol={symbol} />
      </View>

      <Text style={[styles.footer, { color: edge.faint }]}>{EDGE.report.footer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  report: { marginTop: 34 },
  partial: { marginBottom: 14, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.4 },
  heroGrid: { gap: 12 },
  panel: { borderWidth: 1, borderTopLeftRadius: 3, borderTopRightRadius: 16, borderBottomRightRadius: 3, borderBottomLeftRadius: 3, padding: 20 },
  curvePanel: { minWidth: 0 },
  readoutPanel: { minHeight: 280, justifyContent: "space-between" },
  label: { fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 12.8, letterSpacing: 1.44, textTransform: "uppercase" },
  net: { marginTop: 12, fontFamily: FONT.headingHeavy, fontSize: 42, lineHeight: 46, letterSpacing: -2.73, fontVariant: ["tabular-nums"] },
  unit: { fontFamily: FONT.data, fontSize: 11, letterSpacing: 0 },
  roi: { marginTop: 8, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  sample: { marginTop: 6, fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 12.8, letterSpacing: 0.64 },
  readout: { marginTop: 22, fontFamily: FONT.heading, fontSize: 22, lineHeight: 25.52, letterSpacing: -1.21 },
  readoutFoot: { marginTop: 36, fontFamily: FONT.body, fontSize: 10, lineHeight: 15.5 },
  lowerGrid: { marginTop: 48, gap: 48 },
  footer: { marginTop: 70, alignSelf: "center", maxWidth: 620, textAlign: "center", fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 13.6, letterSpacing: 0.32 },
});
