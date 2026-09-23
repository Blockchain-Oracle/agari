import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Defs, Line, LinearGradient, Polygon, Polyline, Stop } from "react-native-svg";
import { STATS } from "@/features/stats/copy";
import { FONT, TYPE, useTheme } from "~/theme";

const HEIGHT = 180;
const PAD_X = 12;
const PAD_T = 16;
const PAD_B = 20;

/**
 * web's `GrowthCurve` (features/stats/GrowthCurve.tsx): cumulative wallets that made a call, by hour. One point is a
 * dot, two or more a line over a gradient fill, no smoothing; the peak labels the right edge. Drawn to the card's width.
 */
export function GrowthCurve({ points }: { points: readonly { atMs: number; cumulative: number }[] }) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  if (points.length === 0) {
    return <Text style={[TYPE.body, styles.empty, { color: color.inkSecondary }]}>{STATS.curve.empty}</Text>;
  }

  const max = Math.max(1, ...points.map((p) => p.cumulative));
  const W = Math.max(1, width);
  const xAt = (i: number) => (points.length === 1 ? W / 2 : PAD_X + (i / (points.length - 1)) * (W - 2 * PAD_X));
  const yAt = (v: number) => HEIGHT - PAD_B - (v / max) * (HEIGHT - PAD_T - PAD_B);
  const pts = points.map((p, i) => ({ x: xAt(i), y: yAt(p.cumulative) }));
  const line = pts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(" ");
  const lastX = points.length === 1 ? W / 2 : W - PAD_X;
  const area = `${PAD_X},${HEIGHT - PAD_B} ${line} ${lastX.toFixed(1)},${HEIGHT - PAD_B}`;
  const last = pts[pts.length - 1];

  return (
    <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={`${STATS.curve.axis}: ${max} at the latest hour`}>
      <View style={styles.axis}>
        <Text style={[styles.axisText, { color: color.inkMuted }]} numberOfLines={1}>
          {STATS.curve.axis}
        </Text>
        <Text style={[styles.max, { color: color.ink }]}>{max}</Text>
      </View>
      {width > 0 ? (
        <Svg width={W} height={HEIGHT}>
          <Defs>
            <LinearGradient id="stats-gc" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color.accent} stopOpacity={0.32} />
              <Stop offset="1" stopColor={color.accent} stopOpacity={0} />
            </LinearGradient>
          </Defs>
          {[0.25, 0.5, 0.75].map((g) => {
            const y = PAD_T + g * (HEIGHT - PAD_T - PAD_B);
            return <Line key={g} x1={PAD_X} x2={W - PAD_X} y1={y} y2={y} stroke={color.hairline} strokeWidth={1} />;
          })}
          <Polygon points={area} fill="url(#stats-gc)" />
          {pts.length > 1 ? <Polyline points={line} fill="none" stroke={color.accent} strokeWidth={2.5} strokeLinejoin="round" /> : null}
          {last ? <Circle cx={last.x} cy={last.y} r={9} fill={color.accentWash} /> : null}
          {last ? <Circle cx={last.x} cy={last.y} r={4.5} fill={color.accent} /> : null}
        </Svg>
      ) : (
        <View style={{ height: HEIGHT }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { paddingVertical: 24 },
  axis: { flexDirection: "row", justifyContent: "space-between", gap: 12, marginBottom: 4 },
  axisText: { fontFamily: FONT.data, fontSize: 9.5, letterSpacing: 1, flexShrink: 1 },
  max: { fontFamily: FONT.dataStrong, fontSize: 12 },
});
