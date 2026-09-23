import type { EquityPoint } from "@agari/core/projection";
import { oneUnit } from "@agari/core/units";
import type { Tone } from "@/features/edge/format";
import { EDGE } from "@/features/edge/copy";
import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { FONT, useTheme } from "~/theme";

const H = 170;
const PAD = 10;

/** Geometry only: base units become floats here to place pixels, never to state a figure (web's `curvePaths`). */
function curvePaths(points: readonly EquityPoint[], decimals: number, W: number) {
  if (points.length < 2) return { line: "", area: "", lastX: PAD, lastY: H / 2, zeroY: H / 2 };
  const one = Number(oneUnit(decimals));
  const values = points.map((point) => Number(point.cumulativeBase) / one);
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (max - min < 0.01) {
    min = -0.5;
    max = 0.5;
  }
  const span = max - min;
  const x = (index: number) => PAD + (index / (points.length - 1)) * (W - PAD * 2);
  const y = (value: number) => PAD + ((max - value) / span) * (H - PAD * 2);
  const line = values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const lastX = x(points.length - 1);
  const lastY = y(values[values.length - 1] as number);
  const zeroY = y(0);
  return { line, area: `${line} L${lastX},${zeroY} L${x(0)},${zeroY} Z`, lastX, lastY, zeroY };
}

/** web's `EdgeCurve`: the dashed zero line, a soft fill, the cumulative line, a ringed marker at the latest close. */
export function EdgeCurve({ points, decimals, tone, label }: { points: readonly EquityPoint[]; decimals: number; tone: Tone; label: string }) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const ink = tone === "gain" ? color.profit : tone === "loss" ? color.loss : color.inkSecondary;
  const wash = tone === "gain" ? color.profitWash : tone === "loss" ? color.lossWash : color.surface2;
  const chart = curvePaths(points, decimals, Math.max(1, width));
  return (
    <View onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))} accessible accessibilityRole="image" accessibilityLabel={label}>
      {width > 0 ? (
        <Svg width={width} height={H}>
          <Line x1={PAD} y1={chart.zeroY} x2={width - PAD} y2={chart.zeroY} stroke={color.borderStrong} strokeDasharray="4 7" />
          <Path d={chart.area} fill={wash} />
          <Path d={chart.line} fill="none" stroke={ink} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          <Circle cx={chart.lastX} cy={chart.lastY} r={9} fill={wash} />
          <Circle cx={chart.lastX} cy={chart.lastY} r={5} fill={ink} stroke={color.ground} strokeWidth={2} />
        </Svg>
      ) : (
        <View style={{ height: H }} />
      )}
      <View style={styles.caption}>
        <Text style={[styles.captionText, { color: color.inkMuted }]}>{EDGE.report.firstClose}</Text>
        <Text style={[styles.captionText, { color: color.inkMuted }]}>{EDGE.report.latestClose}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { flexDirection: "row", justifyContent: "space-between" },
  captionText: { fontFamily: FONT.data, fontSize: 9.5, letterSpacing: 1.2 },
});
