import type { EquityPoint } from "@agari/core/projection";
import { oneUnit } from "@agari/core/units";
import type { Tone } from "@/features/edge/format";
import { EDGE } from "@/features/edge/copy";
import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";
import { FONT } from "~/theme";
import { useEdgeInk } from "./useEdgeInk";

const CHART_W = 760;
const CHART_H = 230;
const PAD = 10;

/** Geometry only: base units become floats here to place pixels, never to state a figure (web's `curvePaths`). */
function curvePaths(points: readonly EquityPoint[], decimals: number) {
  if (points.length < 2) return { line: "", area: "", lastX: PAD, lastY: CHART_H / 2, zeroY: CHART_H / 2 };
  const one = Number(oneUnit(decimals));
  const values = points.map((point) => Number(point.cumulativeBase) / one);
  let min = Math.min(0, ...values);
  let max = Math.max(0, ...values);
  if (max - min < 0.01) {
    min = -0.5;
    max = 0.5;
  }
  const span = max - min;
  const x = (index: number) => PAD + (index / (points.length - 1)) * (CHART_W - PAD * 2);
  const y = (value: number) => PAD + ((max - value) / span) * (CHART_H - PAD * 2);
  const line = values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const lastX = x(points.length - 1);
  const lastY = y(values[values.length - 1] as number);
  const zeroY = y(0);
  return { line, area: `${line} L${lastX},${zeroY} L${x(0)},${zeroY} Z`, lastX, lastY, zeroY };
}

/**
 * web `EdgeCurve` (edge-report.css `.edge-chart`): the 760×230 viewBox scaled to the panel's width, so the dashed zero
 * rule, the 7.5% fill, the 3-unit line and the ringed marker keep web's proportions. The tone colours all of it.
 */
export function EdgeCurve({ points, decimals, tone, label }: { points: readonly EquityPoint[]; decimals: number; tone: Tone; label: string }) {
  const { edge, toneInk } = useEdgeInk();
  const [width, setWidth] = useState(0);
  const ink = toneInk(tone);
  const chart = curvePaths(points, decimals);
  return (
    <View style={styles.wrap}>
      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityRole="image" accessibilityLabel={label}>
        {width > 0 ? (
          <Svg width={width} height={(width * CHART_H) / CHART_W} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
            <Line x1={PAD} y1={chart.zeroY} x2={CHART_W - PAD} y2={chart.zeroY} stroke={edge.ruleStrong} strokeWidth={1} strokeDasharray="4 7" />
            <Path d={chart.area} fill={ink} fillOpacity={0.075} />
            <Path d={chart.line} fill="none" stroke={ink} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
            <Circle cx={chart.lastX} cy={chart.lastY} r={5} fill={edge.surface} stroke={ink} strokeWidth={3} />
          </Svg>
        ) : null}
      </View>
      <View style={styles.caption}>
        <Text style={[styles.captionText, { color: edge.faint }]}>{EDGE.report.firstClose}</Text>
        <Text style={[styles.captionText, { color: edge.faint }]}>{EDGE.report.latestClose}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 28 },
  caption: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
  captionText: { fontFamily: FONT.dataRegular, fontSize: 7, lineHeight: 11.2, letterSpacing: 0.84 },
});
