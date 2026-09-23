import type { Badge, ReputationData, TraderEdge } from "@agari/core/projection";
import { formatBaseUnits } from "@agari/core/units";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";
import { EDGE } from "@/features/edge/copy";
import { signedMoney } from "@/features/edge/format";
import { HISTORY } from "@/features/markets/history/copy";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

const CURVE_W = 300;
const CURVE_H = 56;

/** web's `EquitySparkline`: the cumulative result curve, scaled from the integers (display-only floats). */
function Curve({ edge }: { edge: TraderEdge }) {
  const { color } = useTheme();
  const values = edge.equity.map((p) => Number(p.cumulativeBase));
  if (values.length < 2) return <Text style={[TYPE.caption, { color: color.inkMuted }]}>{HISTORY.summary.curveEmpty}</Text>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => `${(i / (values.length - 1)) * CURVE_W},${CURVE_H - ((v - min) / span) * (CURVE_H - 4) - 2}`).join(" ");
  const ink = edge.netBase >= 0n ? color.profit : color.loss;
  return (
    <Svg width="100%" height={CURVE_H} viewBox={`0 0 ${CURVE_W} ${CURVE_H}`} preserveAspectRatio="none" accessible={false}>
      <Polyline points={points} fill="none" stroke={ink} strokeWidth={2} strokeLinejoin="round" />
    </Svg>
  );
}

/** web's `HistorySummary`: net over every settled Window, the curve, win rate and the current run. */
export function HistorySummary({ edge, decimals, symbol }: { edge: TraderEdge; decimals: number; symbol: string }) {
  const { color } = useTheme();
  const S = HISTORY.summary;
  const netInk = edge.netBase > 0n ? color.profit : edge.netBase < 0n ? color.loss : color.ink;
  return (
    <View style={[styles.plate, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{S.net}</Text>
      <Text style={[TYPE.dataHero, styles.net, { color: netInk }]}>{signedMoney(edge.netBase, decimals, symbol)}</Text>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{S.rounds(edge.settledRounds, edge.openRounds)}</Text>
      <Curve edge={edge} />
      <View style={styles.pair}>
        <View style={styles.pairCell}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{S.winRate}</Text>
          <Text style={[TYPE.data, { color: color.ink }]}>{edge.winRatePct === null ? S.notYet : `${edge.winRatePct.toFixed(0)}%`}</Text>
        </View>
        <View style={styles.pairCell}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{S.streak}</Text>
          <Text style={[TYPE.data, { color: color.ink }]}>
            {edge.currentWinStreak} {S.streakUnit(edge.currentWinStreak)}
          </Text>
        </View>
      </View>
    </View>
  );
}

const BADGE_ICON: Record<Badge["id"], SymbolViewProps["name"]> = {
  first_trade: { ios: "target", android: "target" },
  winning_streak: { ios: "flame.fill", android: "local_fire_department" },
  lp_provider: { ios: "drop.fill", android: "water_drop" },
  whale: { ios: "chart.bar.xaxis", android: "bar_chart" },
  oracle: { ios: "crown.fill", android: "workspace_premium" },
};

function Bar({ pct, label }: { pct: number; label: string }) {
  const { color } = useTheme();
  return (
    <View
      style={[styles.bar, { backgroundColor: color.surface2 }]}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: pct }}
    >
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color.accent }]} />
    </View>
  );
}

/** web's `ReputationPanel` + `BadgeGrid`: tier, the record it rests on, the distance to the next; then the badges. */
export function ReputationPanel({ reputation, badges }: { reputation: ReputationData; badges: readonly Badge[] }) {
  const { color } = useTheme();
  const R = HISTORY.reputation;
  const earned = badges.filter((b) => b.earned).length;
  const next = badges.find((b) => !b.earned && b.pending === null);
  return (
    <View style={styles.stack}>
      <View style={[styles.plate, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{R.tier}</Text>
        <Text style={[TYPE.headline, { color: color.ink }]}>{R.tiers[reputation.tier]}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{R.record(reputation.bets, reputation.wins)}</Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{reputation.nextTier ? R.next(R.tiers[reputation.nextTier]) : R.top}</Text>
        <Bar pct={reputation.progressToNext} label={R.progress(reputation.progressToNext)} />
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{R.rule}</Text>
      </View>
      <View style={styles.rank}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{R.seasonRank}</Text>
        <Text style={[TYPE.dataLg, { color: color.ink }]}>
          {earned}/{badges.length}
        </Text>
        <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
          {next ? R.next(HISTORY.badges.names[next.id].name) : R.unlocked(earned, badges.length)}
        </Text>
      </View>
      <View style={styles.badges}>
        {badges.map((badge, index) => {
          const words = HISTORY.badges.names[badge.id];
          const state = badge.earned ? HISTORY.badges.unlocked : badge.pending === "earn" ? HISTORY.badges.pendingEarn : HISTORY.badges.locked;
          return (
            <View
              key={badge.id}
              accessible
              accessibilityLabel={`${words.name}, ${state}. ${words.description}`}
              style={[
                styles.badge,
                { backgroundColor: badge.earned ? color.accentWash : color.surface1, borderColor: badge.earned ? color.accentDim : color.hairline, opacity: badge.earned ? 1 : 0.7 },
              ]}
            >
              <View style={styles.badgeHead}>
                <Text style={[styles.badgeMeta, { color: color.inkMuted }]}>{String(index + 1).padStart(2, "0")}</Text>
                <Text style={[styles.badgeMeta, { color: badge.earned ? color.accent : color.inkMuted }]}>{state}</Text>
              </View>
              <SymbolView name={BADGE_ICON[badge.id]} size={22} tintColor={badge.earned ? color.accent : color.inkMuted} />
              <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{words.name}</Text>
              <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{words.description}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** web's `EdgeMetrics`: four figures, each with the sentence that says what it is measured over. */
export function EdgeMetrics({ report, decimals, symbol }: { report: TraderEdge; decimals: number; symbol: string }) {
  const { color } = useTheme();
  const m = EDGE.report.metrics;
  const expectInk = report.expectancyBase === null ? color.ink : report.expectancyBase > 0n ? color.profit : report.expectancyBase < 0n ? color.loss : color.ink;
  const cells = [
    { label: m.winRate.label, value: report.winRatePct === null ? m.winRate.unset : `${report.winRatePct.toFixed(0)}%`, note: m.winRate.note(report.wins, report.losses), ink: color.ink },
    { label: m.profitFactor.label, value: report.profitFactor === null ? m.profitFactor.noLoss : report.profitFactor.toFixed(2), note: m.profitFactor.note, ink: color.ink },
    { label: m.expectancy.label, value: report.expectancyBase === null ? m.expectancy.unset : signedMoney(report.expectancyBase, decimals, symbol), note: m.expectancy.note, ink: expectInk },
    { label: m.drawdown.label, value: formatBaseUnits(report.maxDrawdownBase, decimals), note: m.drawdown.note(symbol), ink: color.ink },
  ];
  return (
    <View style={styles.metrics}>
      {cells.map((cell) => (
        <View key={cell.label} style={[styles.metric, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessible accessibilityLabel={`${cell.label}: ${cell.value}. ${cell.note}`}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{cell.label}</Text>
          <Text style={[TYPE.dataLg, { color: cell.ink }]}>{cell.value}</Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{cell.note}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 6 },
  net: { fontSize: 32, lineHeight: 36 },
  pair: { flexDirection: "row", gap: 24, marginTop: 4 },
  pairCell: { gap: 2 },
  stack: { gap: 12 },
  bar: { height: 6, borderRadius: RADIUS.full, overflow: "hidden", marginVertical: 4 },
  barFill: { height: 6, borderRadius: RADIUS.full },
  rank: { gap: 2 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badge: { width: "47.5%", flexGrow: 1, borderRadius: RADIUS.lg, borderWidth: 1, padding: 12, gap: 6 },
  badgeHead: { flexDirection: "row", justifyContent: "space-between" },
  badgeMeta: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "47.5%", flexGrow: 1, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 4 },
});
