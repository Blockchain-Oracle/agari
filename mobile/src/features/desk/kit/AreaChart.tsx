import { useMemo, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop, Text as SvgText } from "react-native-svg";
import { haptic } from "~/components/kit";
import { FONT, TYPE, useTheme } from "~/theme";

/** A point on the chart; values are dollars, floats only at this display edge (the money stays bigint upstream). */
export interface AreaPoint {
  timeSec: number;
  value: number;
}

const PAD = { top: 14, right: 58, bottom: 8, left: 4 };

/** Fritsch–Carlson monotone cubic through the points, as the 21st chart's `monotonePath`: no overshoot between checks. */
function monotonePath(xs: readonly number[], ys: readonly number[]): string {
  const n = xs.length;
  if (n < 2) return "";
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i += 1) {
    dx.push(xs[i + 1]! - xs[i]!);
    m.push((ys[i + 1]! - ys[i]!) / (dx[i] || 1));
  }
  const t: number[] = [m[0]!];
  for (let i = 1; i < n - 1; i += 1) t.push(m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2);
  t.push(m[n - 2]!);
  let d = `M${xs[0]!.toFixed(1)},${ys[0]!.toFixed(1)}`;
  for (let i = 0; i < n - 1; i += 1) {
    const h = dx[i]! / 3;
    d += ` C${(xs[i]! + h).toFixed(1)},${(ys[i]! + t[i]! * h).toFixed(1)} ${(xs[i + 1]! - h).toFixed(1)},${(ys[i + 1]! - t[i + 1]! * h).toFixed(1)} ${xs[i + 1]!.toFixed(1)},${ys[i + 1]!.toFixed(1)}`;
  }
  return d;
}

const money = (v: number): string => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (sec: number): string =>
  new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(sec * 1000));

// 21st: arihantcodes_1f7b8c4d/portfolio-chart
/**
 * The desk's value chart (web's AreaChart.client.tsx, 21st Portfolio Chart #29532): the value at every check as a
 * monotone area in the move's tone, the baseline (what went in) as a dashed rule, three price ticks on the right, and
 * a finger-scrubbed crosshair with the exact value and time of the check under it.
 */
export function AreaChart({ points, baseline, tone, height = 200, label }: { points: readonly AreaPoint[]; baseline: number | null; tone: "up" | "down" | "flat"; height?: number; label: string }) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const ink = tone === "up" ? color.profit : tone === "down" ? color.loss : color.ink;

  const geo = useMemo(() => {
    const values = [...points.map((p) => p.value), ...(baseline !== null ? [baseline] : [])];
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const pad = Math.max((hi - lo) * 0.18, hi * 0.002, 0.01);
    const min = lo - pad;
    const max = hi + pad;
    const x0 = PAD.left;
    const x1 = Math.max(x0 + 1, width - PAD.right);
    const t0 = points[0]?.timeSec ?? 0;
    const t1 = points.at(-1)?.timeSec ?? 1;
    const x = (sec: number) => x0 + ((sec - t0) / Math.max(1, t1 - t0)) * (x1 - x0);
    const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * (height - PAD.top - PAD.bottom);
    const xs = points.map((p) => x(p.timeSec));
    const ys = points.map((p) => y(p.value));
    const line = monotonePath(xs, ys);
    const area = `${line} L${xs.at(-1)?.toFixed(1)},${height} L${xs[0]?.toFixed(1)},${height} Z`;
    const ticks = [max - pad, (min + max) / 2, min + pad].map((v) => ({ v, y: y(v) }));
    return { xs, ys, line, area, ticks, y, x1 };
  }, [points, baseline, width, height]);

  const pick = (px: number) => {
    let best = 0;
    for (let i = 1; i < geo.xs.length; i += 1) if (Math.abs(geo.xs[i]! - px) < Math.abs(geo.xs[best]! - px)) best = i;
    setHover((prev) => {
      if (prev !== best) haptic.select();
      return best;
    });
  };
  const scrub = Gesture.Pan()
    .activeOffsetX([-6, 6])
    .failOffsetY([-14, 14])
    .onBegin((e) => runOnJS(pick)(e.x))
    .onUpdate((e) => runOnJS(pick)(e.x))
    .onFinalize(() => runOnJS(setHover)(null));

  const shown = hover !== null ? points[hover] : null;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label}>
      <View style={styles.readout}>
        {shown ? (
          <>
            <Text style={[TYPE.data, { color: color.ink }]}>{money(shown.value)}</Text>
            <Text style={[TYPE.caption, { color: color.inkMuted }]}>{when(shown.timeSec)}</Text>
          </>
        ) : null}
      </View>
      <GestureDetector gesture={scrub}>
        <View style={{ height }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
          {width > 0 ? (
            <Svg width={width} height={height}>
              <Defs>
                <LinearGradient id="desk-area" x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={ink} stopOpacity={0.28} />
                  <Stop offset="1" stopColor={ink} stopOpacity={0} />
                </LinearGradient>
              </Defs>
              {geo.ticks.map((t) => (
                <Line key={t.v} x1={PAD.left} x2={geo.x1} y1={t.y} y2={t.y} stroke={color.hairline} strokeWidth={StyleSheet.hairlineWidth} />
              ))}
              {geo.ticks.map((t) => (
                <SvgText key={`l-${t.v}`} x={width - 2} y={t.y + 4} fill={color.inkMuted} fontFamily={FONT.data} fontSize={10.5} textAnchor="end">
                  {money(t.v)}
                </SvgText>
              ))}
              {baseline !== null ? <Line x1={PAD.left} x2={geo.x1} y1={geo.y(baseline)} y2={geo.y(baseline)} stroke={color.inkMuted} strokeWidth={1} strokeDasharray={[4, 4]} /> : null}
              <Path d={geo.area} fill="url(#desk-area)" />
              <Path d={geo.line} fill="none" stroke={ink} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {hover !== null ? (
                <>
                  <Line x1={geo.xs[hover]} x2={geo.xs[hover]} y1={PAD.top} y2={height} stroke={color.inkMuted} strokeWidth={1} strokeDasharray={[2, 3]} />
                  <Circle cx={geo.xs[hover]} cy={geo.ys[hover]} r={4.5} fill={color.ground} stroke={ink} strokeWidth={2} />
                </>
              ) : (
                <Circle cx={geo.xs.at(-1)} cy={geo.ys.at(-1)} r={3.5} fill={ink} />
              )}
            </Svg>
          ) : null}
        </View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  readout: { height: 22, flexDirection: "row", alignItems: "baseline", gap: 8 },
});
