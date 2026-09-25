import { roundsToCsv, type EquityPoint, type TraderEdge, type WalletHistory } from "@agari/core/projection";
import { formatBaseUnits } from "@agari/core/units";
import { Download } from "lucide-react-native";
import { useId } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { HISTORY } from "@/features/markets/history/copy";
import { pushToast } from "~/components/toast/store";
import { FONT, useTheme } from "~/theme";
import { profileTokens } from "~/theme/web/explore/profile";

const WIDTH = 300;
const HEIGHT = 72;
const PAD = 3;

/**
 * web's EquitySparkline (history.css `.equity-*`): cumulative net, one step per settled round, vermilion at or above
 * zero and muted ink below, the dashed zero line, the end dot and its halo; stretched to the strip as web's
 * `preserveAspectRatio="none"` does.
 */
function Sparkline({ points, decimals }: { points: readonly EquityPoint[]; decimals: number }) {
  const { name, color } = useTheme();
  const t = profileTokens(name);
  const id = `eq${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  if (points.length < 2) {
    return (
      <View style={[styles.equityEmpty, { borderColor: t.equityEmptyBorder, backgroundColor: t.equityEmptyFill }]}>
        <Text style={[styles.micro, { color: t.equityEmptyInk }]}>{HISTORY.summary.curveEmpty}</Text>
      </View>
    );
  }
  const values = points.map((p) => p.cumulativeBase);
  let low = values.reduce((min, v) => (v < min ? v : min), 0n);
  let high = values.reduce((max, v) => (v > max ? v : max), 0n);
  if (high === low) {
    high += 1n;
    low -= 1n;
  }
  const span = Number(high - low);
  const count = points.length;
  const x = (i: number) => PAD + (i / (count - 1)) * (WIDTH - PAD * 2);
  const y = (v: bigint) => PAD + (1 - Number(v - low) / span) * (HEIGHT - PAD * 2);
  const zeroY = y(0n);
  const line = `M ${points.map((p, i) => `${x(i).toFixed(2)},${y(p.cumulativeBase).toFixed(2)}`).join(" L ")}`;
  const area = `${line} L ${x(count - 1).toFixed(2)},${zeroY.toFixed(2)} L ${x(0).toFixed(2)},${zeroY.toFixed(2)} Z`;
  const last = points[count - 1] as EquityPoint;
  const up = last.cumulativeBase >= 0n;
  const ink = up ? color.accent : t.equityDown;
  const amount = formatBaseUnits(last.cumulativeBase < 0n ? -last.cumulativeBase : last.cumulativeBase, decimals);
  return (
    <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" accessibilityRole="image" accessibilityLabel={HISTORY.summary.curveLabel(up ? "up" : "down", amount)}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color.accent} stopOpacity={0.22} />
          <Stop offset="1" stopColor={color.accent} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Line x1={PAD} x2={WIDTH - PAD} y1={zeroY} y2={zeroY} stroke={t.equityZero} strokeWidth={1} strokeDasharray="2 3" />
      <Path d={area} fill={`url(#${id})`} />
      <Path d={line} fill="none" stroke={ink} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
      <Circle cx={x(count - 1)} cy={y(last.cumulativeBase)} r={2.6} fill={up ? color.accent : color.ink} />
      <Circle cx={x(count - 1)} cy={y(last.cumulativeBase)} r={5} fill="none" stroke={up ? color.accent : color.ink} strokeWidth={1} strokeOpacity={0.3} />
    </Svg>
  );
}

/**
 * web's HistorySummary: net over every settled Window, the curve that produced it, the win rate and the current run,
 * then the rows as a file — the CSV goes out through the system share sheet, the app's download.
 */
export function HistorySummary({ history, edge, address, symbol }: { history: WalletHistory; edge: TraderEdge; address: string; symbol: string | undefined }) {
  const { name, color } = useTheme();
  const t = profileTokens(name);
  const net = edge.netBase;
  const ink = net > 0n ? color.profit : net < 0n ? color.loss : color.inkSecondary;
  const noRounds = history.rounds.length === 0;
  const download = async () => {
    try {
      await Share.share({ title: HISTORY.csvName(address), message: roundsToCsv(history.rounds) });
    } catch {
      pushToast({ title: HISTORY.csvFailed, tone: "warning" });
    }
  };
  return (
    <View style={[styles.plate, { backgroundColor: t.plate, borderColor: t.plateBorder }]}>
      <View style={styles.figure}>
        <Text style={[styles.micro, { color: color.inkMuted }]}>{HISTORY.summary.net}</Text>
        <Text style={[styles.net, { color: ink }]}>
          {formatBaseUnits(net, history.decimals, { signed: true })}
          {symbol ? <Text style={{ color: color.inkSecondary }}> {symbol}</Text> : null}
        </Text>
        <Text style={[styles.caption, { color: color.inkSecondary }]}>{HISTORY.summary.rounds(edge.settledRounds, edge.openRounds)}</Text>
      </View>
      <Sparkline points={edge.equity} decimals={history.decimals} />
      <View style={styles.stats}>
        <View>
          <Text style={[styles.micro, { color: color.inkMuted }]}>{HISTORY.summary.winRate}</Text>
          <Text style={[styles.data, { color: color.ink }]}>{edge.winRatePct === null ? HISTORY.summary.notYet : `${edge.winRatePct.toFixed(0)}%`}</Text>
        </View>
        <View>
          <Text style={[styles.micro, { color: color.inkMuted }]}>{HISTORY.summary.streak}</Text>
          <Text style={[styles.data, { color: color.ink }]}>
            {edge.currentWinStreak} {HISTORY.summary.streakUnit(edge.currentWinStreak)}
          </Text>
        </View>
      </View>
      <Pressable
        onPress={() => void download()}
        disabled={noRounds}
        accessibilityRole="button"
        style={({ pressed }) => [styles.csv, { borderColor: t.plateBorder, backgroundColor: t.csvFill, opacity: noRounds ? 0.5 : pressed ? 0.8 : 1 }]}
      >
        <Download size={14} color={color.ink} />
        <Text style={[styles.csvText, { color: color.ink }]}>{HISTORY.csv}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  plate: { gap: 16, padding: 16, borderWidth: 1, borderRadius: 12 },
  figure: { gap: 4 },
  micro: { fontFamily: FONT.bodyMedium, fontSize: 11, lineHeight: 13.2, letterSpacing: 1.76, textTransform: "uppercase" },
  net: { fontFamily: FONT.bodyStrong, fontSize: 20, lineHeight: 24, fontVariant: ["tabular-nums"] },
  caption: { fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
  stats: { flexDirection: "row", gap: 28 },
  data: { fontFamily: FONT.bodyMedium, fontSize: 14, lineHeight: 18.2, fontVariant: ["tabular-nums"] },
  equityEmpty: { minHeight: 72, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  csv: { alignSelf: "flex-start", height: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 8, paddingRight: 12, borderWidth: 1, borderRadius: 8 },
  csvText: { fontFamily: FONT.bodyMedium, fontSize: 13.125, lineHeight: 18.75 },
});
