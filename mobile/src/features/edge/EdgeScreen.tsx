import { computeTraderEdge, type TraderEdge, type WalletHistory } from "@agari/core/projection";
import { isOk } from "@agari/core/schemas";
import { router } from "expo-router";
import { useMemo, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EDGE } from "@/features/edge/copy";
import { signedMoney, signedPct, toneOf } from "@/features/edge/format";
import { useHistoryReading } from "@/features/markets/history/useHistoryReading";
import { useVenue } from "@/features/markets/useVenue";
import { diagnosisCopy } from "@/lib/copy";
import { Button, Card, LoadingState, Screen, SectionHeader } from "~/components/kit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { EdgeCurve } from "./EdgeCurve";
import { EdgeMetrics, EdgePayoff, EdgeWindows } from "./EdgeSections";

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

/** web's `EdgeState`: the tall lined panel for connect, failed and nothing settled. */
function EdgeState({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={[styles.state, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <Text style={[styles.eyebrow, { color: color.accent }]}>{eyebrow.toUpperCase()}</Text>
      <Text style={[TYPE.title, { color: color.ink }]}>{title}</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{copy}</Text>
      {action}
    </View>
  );
}

/** web's `EdgeReport`: the net result over the curve, the readout, the metrics, timing and payoff. */
function Report({ history, report, symbol }: { history: WalletHistory; report: TraderEdge; symbol: string }) {
  const { color } = useTheme();
  const { decimals } = history;
  const tone = toneOf(report.netBase);
  const net = signedMoney(report.netBase, decimals);
  const ink = tone === "gain" ? color.profit : tone === "loss" ? color.loss : color.ink;
  const [settledLine, openLine] = EDGE.report.sample(report.settledRounds, report.openRounds);
  return (
    <>
      {!history.complete ? <Text style={[TYPE.caption, { color: color.warning }]}>{EDGE.states.partial}</Text> : null}
      <SectionHeader index="01" title={EDGE.report.netLabel} aside={`${settledLine} · ${openLine}`} />
      <Card>
        <Text style={[TYPE.dataHero, { color: ink }]} accessibilityLabel={`${EDGE.report.netLabel}: ${net} ${symbol}`}>
          {net}
          <Text style={[styles.unit, { color: color.inkMuted }]}> {symbol}</Text>
        </Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
          {report.roiPct === null ? EDGE.report.roiUnavailable : EDGE.report.roi(signedPct(report.roiPct))}
        </Text>
        <EdgeCurve points={report.equity} decimals={decimals} tone={tone} label={EDGE.report.chartLabel(`${net} ${symbol}`, report.settledRounds)} />
      </Card>
      <Card tone="accent">
        <Text style={[styles.eyebrow, { color: color.accent }]}>{EDGE.report.readoutLabel.toUpperCase()}</Text>
        <Text style={[TYPE.title, { color: color.ink }]}>{readoutText(report, decimals, symbol)}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{EDGE.report.readoutFoot}</Text>
      </Card>
      <SectionHeader index="02" title="Performance" />
      <EdgeMetrics report={report} decimals={decimals} symbol={symbol} />
      <EdgeWindows windows={report.windows} decimals={decimals} symbol={symbol} />
      <EdgePayoff report={report} decimals={decimals} symbol={symbol} />
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{EDGE.report.footer}</Text>
    </>
  );
}

/**
 * `/portfolio/edge` — web's TraderEdgeScreen (features/edge/TraderEdgeScreen.tsx): the connected wallet's settled
 * Windows from the fill projection, as a record of what pays, what costs and when it trades best. Every state web
 * draws: connect, reading, failed with a retry, nothing settled yet, and the report.
 */
export function EdgeScreen() {
  const { color } = useTheme();
  const history = useHistoryReading();
  const { boot } = useVenue();
  const symbol = boot && isOk(boot) ? boot.value.collateral.symbol : "";
  const value = history.reading?.ok ? history.reading.value : null;
  const report = useMemo(() => (value ? computeTraderEdge(value.rounds, value.openCount) : null), [value]);
  const words = EDGE.intro;

  let body: ReactNode;
  if (!history.address) {
    body = <EdgeState {...EDGE.states.connect} action={<Button label="Connect" onPress={() => router.push("/connect")} />} />;
  } else if (history.reading === null) {
    body = <LoadingState shape="chart" label={EDGE.states.reading} />;
  } else if (!history.reading.ok) {
    body = (
      <EdgeState
        eyebrow={EDGE.states.failed.eyebrow}
        title={EDGE.states.failed.title}
        copy={diagnosisCopy(history.reading.error.kind).headline}
        action={<Button label={EDGE.states.failed.retry} variant="secondary" onPress={history.retry} />}
      />
    );
  } else if (!value || !report || report.settledRounds === 0) {
    const open = value?.openCount ?? 0;
    body = (
      <EdgeState
        eyebrow={EDGE.states.none.eyebrow}
        title={EDGE.states.none.title}
        copy={open > 0 ? EDGE.states.none.open(open) : EDGE.states.none.first}
        action={<Button label={EDGE.states.none.action} onPress={() => router.navigate("/markets")} />}
      />
    );
  } else {
    body = <Report history={value} report={report} symbol={symbol} />;
  }

  return (
    <Screen title={EDGE.title} onRefresh={history.address ? history.retry : undefined}>
      <View style={styles.intro}>
        <Text style={[styles.folio, { color: color.accent }]}>{words.folio}</Text>
        <Text style={[TYPE.display, { color: color.ink }]} accessibilityRole="header">
          {words.title}
        </Text>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{words.lede}</Text>
        <View style={[styles.meta, { borderColor: color.hairline }]}>
          {[words.source, words.method].map((item) => (
            <View key={item.label} style={styles.metaItem}>
              <Text style={[styles.eyebrow, { color: color.inkMuted }]}>{item.label.toUpperCase()}</Text>
              <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{item.value}</Text>
            </View>
          ))}
        </View>
      </View>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  intro: { gap: 10 },
  folio: { fontFamily: FONT.dataStrong, fontSize: 12, letterSpacing: 1.6 },
  meta: { flexDirection: "row", gap: 16, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  metaItem: { flex: 1, gap: 2 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.4 },
  state: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 20, gap: 10 },
  unit: { fontFamily: FONT.data, fontSize: 14 },
});
