import type { EquityPoint } from "@agari/core/projection";
import { formatBaseUnits } from "@agari/core/units";
import { useId } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Path } from "react-native-svg";
import { Stop, stopPaint } from "~/components/ui/SvgStop";
import { HISTORY } from "@/features/markets/history/copy";
import { FONT } from "~/theme";
import { useStrat } from "./ui";

const WIDTH = 300;
const HEIGHT = 72;
const PAD = 3;

/** The record's curve points: a seed at zero, then one step per settled copy-trade (web's RecordCard / StrategyCard). */
export function curvePoints(curve: readonly { atSec: number; cumBase: string }[]): EquityPoint[] {
  return [{ atMs: null, cumulativeBase: 0n }, ...curve.map((p) => ({ atMs: p.atSec * 1000, cumulativeBase: BigInt(p.cumBase) }))];
}

/**
 * web's features/markets/history/EquitySparkline.tsx at `w-full` (the 300×72 viewBox stretched across its slot, so its
 * height follows the width) with history.css's colours: vermilion at or above zero, muted ink below, the dashed zero.
 */
export function EquitySparkline({ points, decimals }: { points: readonly EquityPoint[]; decimals: number }) {
  const { t } = useStrat();
  const gradientId = `eq${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const series = points.length < 2 ? [] : points;
  if (series.length === 0) {
    return (
      <View style={[styles.empty, { borderColor: t.equityEmptyBorder, backgroundColor: t.equityEmptyBg }]}>
        <Text style={[styles.emptyText, { color: t.equityEmptyInk }]}>{HISTORY.summary.curveEmpty}</Text>
      </View>
    );
  }
  const values = series.map((p) => p.cumulativeBase);
  let low = values.reduce((min, v) => (v < min ? v : min), 0n);
  let high = values.reduce((max, v) => (v > max ? v : max), 0n);
  if (high === low) {
    high += 1n;
    low -= 1n;
  }
  const span = Number(high - low);
  const count = series.length;
  const x = (i: number) => PAD + (i / (count - 1)) * (WIDTH - PAD * 2);
  const y = (v: bigint) => PAD + (1 - Number(v - low) / span) * (HEIGHT - PAD * 2);
  const zeroY = y(0n);
  const line = `M ${series.map((p, i) => `${x(i).toFixed(2)},${y(p.cumulativeBase).toFixed(2)}`).join(" L ")}`;
  const area = `${line} L ${x(count - 1).toFixed(2)},${zeroY.toFixed(2)} L ${x(0).toFixed(2)},${zeroY.toFixed(2)} Z`;
  const last = series[count - 1] as EquityPoint;
  const up = last.cumulativeBase >= 0n;
  const stroke = up ? t.vermilion : t.equityDown;
  const dot = up ? t.vermilion : t.equityDownDot;
  const amount = formatBaseUnits(last.cumulativeBase < 0n ? -last.cumulativeBase : last.cumulativeBase, decimals);
  return (
    <View style={styles.frame} accessible accessibilityRole="image" accessibilityLabel={HISTORY.summary.curveLabel(up ? "up" : "down", amount)}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" {...stopPaint(t.vermilion, 0.22)} />
            <Stop offset="1" {...stopPaint(t.vermilion, 0)} />
          </LinearGradient>
        </Defs>
        <Line x1={PAD} x2={WIDTH - PAD} y1={zeroY} y2={zeroY} stroke={t.equityZero} strokeWidth={1} strokeDasharray="2 3" />
        <Path d={area} fill={`url(#${gradientId})`} />
        <Path d={line} fill="none" stroke={stroke} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
        <Circle cx={x(count - 1)} cy={y(last.cumulativeBase)} r={2.6} fill={dot} />
        <Circle cx={x(count - 1)} cy={y(last.cumulativeBase)} r={5} fill="none" stroke={dot} strokeWidth={1} strokeOpacity={0.3} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: "100%", aspectRatio: WIDTH / HEIGHT },
  empty: { minHeight: 72, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontFamily: FONT.bodyStrong, fontSize: 11, lineHeight: 13, letterSpacing: 1.76, textTransform: "uppercase" },
});
