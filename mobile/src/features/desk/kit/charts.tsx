import { useEffect, useState, type ReactNode } from "react";
import { Easing, StyleSheet, Text, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import { useSvgTween } from "~/components/ui/svg-clock";
import Svg, { Circle, Path } from "react-native-svg";
import { FONT } from "~/theme";
import { useDeskTheme } from "./theme";

/**
 * The desk kit's small charts, ported from web/src/components/ui/desk-kit/charts.tsx (21st Traffic Source Donut
 * #29204, Partition Bar #26545, Progress radial #3424, Mini Chart #9613) to react-native-svg; their motion runs on `useSvgTween`.
 */
export interface Slice {
  id: string;
  label: string;
  /** Any unit; slices are drawn as shares of the sum. */
  value: number;
  color: string;
}

const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/** One arc of a ring in its own Svg over the track, drawing in from zero on mount and gliding when its length changes. */
function Arc({ size, r, stroke, color, length, start, circumference, round, ms }: { size: number; r: number; stroke: number; color: string; length: number; start: number; circumference: number; round?: boolean; ms: number }) {
  const reduce = useReducedMotion();
  const drawn = useSvgTween(length, reduce ? 0 : ms, EASE);
  return (
    <Svg width={size - drawn.repaint} height={size} style={[StyleSheet.absoluteFill, styles.turn]}>
      <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap={round ? "round" : "butt"} strokeDashoffset={-start} strokeDasharray={[Math.max(0.001, drawn.value), circumference]} />
    </Svg>
  );
}

/** `.dkit-donut`: a ring of slices with a figure (or another ring) in the middle. */
export function Donut({ slices, size = 160, thickness = 16, children, label }: { slices: readonly Slice[]; size?: number; thickness?: number; children?: ReactNode; label: string }) {
  const { color } = useDeskTheme();
  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const total = slices.reduce((s, x) => s + Math.max(0, x.value), 0);
  const gap = slices.filter((s) => s.value > 0).length > 1 ? 2 : 0;
  let offset = 0;
  const arcs = slices.map((s) => {
    const len = total > 0 ? (Math.max(0, s.value) / total) * c : 0;
    const arc = { id: s.id, color: s.color, length: Math.max(0, len - gap), start: offset };
    offset += len;
    return arc;
  });
  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Svg width={size} height={size} style={[StyleSheet.absoluteFill, styles.turn]}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color.hairline} strokeWidth={thickness} />
      </Svg>
      {total > 0 ? arcs.filter((a) => a.length > 0).map((a) => <Arc key={a.id} size={size} r={r} stroke={thickness} color={a.color} length={a.length} start={a.start} circumference={c} ms={600} />) : null}
      {children ? <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View> : null}
    </View>
  );
}

/** `.dkit-gauge`: 0–100, tinted by how close it is to full unless a tone is given; a string child is the centre figure. */
export function RadialGauge({ value, size = 64, stroke = 6, tone, children, label }: { value: number; size?: number; stroke?: number; tone?: "accent" | "warn" | "loss" | "profit"; children?: ReactNode; label: string }) {
  const { color } = useDeskTheme();
  const clamped = Math.max(0, Math.min(100, value));
  const picked = tone ?? (clamped >= 90 ? "loss" : clamped >= 70 ? "warn" : "accent");
  const ink = { accent: color.accent, warn: color.warning, loss: color.loss, profit: color.profit }[picked];
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}>
      <Svg width={size} height={size} style={[StyleSheet.absoluteFill, styles.turn]}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color.hairline} strokeWidth={stroke} />
      </Svg>
      {clamped > 0 ? <Arc size={size} r={r} stroke={stroke} color={ink} length={(clamped / 100) * c} start={0} circumference={c} round ms={800} /> : null}
      {children !== undefined ? (
        <View style={[StyleSheet.absoluteFill, styles.center]}>
          {typeof children === "string" ? <Text style={[styles.gaugeText, { color: color.ink }]}>{children}</Text> : children}
        </View>
      ) : null}
    </View>
  );
}

/** `.dkit-partition`: one bar split into slices on the hairline; `warn` rings it in the warning ink. */
export function PartitionBar({ slices, height = 12, warn = false, label }: { slices: readonly Slice[]; height?: number; warn?: boolean; label: string }) {
  const { color } = useDeskTheme();
  const shown = slices.filter((s) => s.value > 0);
  const bar = (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.bar, { height, backgroundColor: color.hairline }]}>
      {shown.map((s) => (
        <View key={s.id} style={{ flexGrow: s.value, flexBasis: 0, minWidth: 2, backgroundColor: s.color }} />
      ))}
    </View>
  );
  if (!warn) return bar;
  return <View style={[styles.warn, { borderColor: color.warning }]}>{bar}</View>;
}

/** A Sparkline as wide as its container (web's `.cp-spark { width: 100% }`). */
export function FillSparkline({ values, height = 44 }: { values: readonly number[]; height?: number }) {
  const [width, setWidth] = useState(0);
  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? <Sparkline values={values} width={width} height={height} /> : null}
    </View>
  );
}

/** `.dkit-spark`: a tiny line with a soft fill, drawn left to right; one point draws a dashed rule. */
export function Sparkline({ values, width = 96, height = 28, tone }: { values: readonly number[]; width?: number; height?: number; tone?: "up" | "down" | "flat" }) {
  const { color, t } = useDeskTheme();
  const reduce = useReducedMotion();
  const drawn = useSvgTween(1, reduce ? 0 : 900, EASE);
  if (values.length < 2) return <View style={{ width, height, borderBottomWidth: 1, borderStyle: "dashed", borderColor: color.hairline }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - ((v - min) / span) * (height - 4)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const first = values[0] ?? 0;
  const last = values.at(-1) ?? 0;
  const tn = tone ?? (last > first ? "up" : last < first ? "down" : "flat");
  const ink = tn === "up" ? color.profit : tn === "down" ? color.loss : color.inkSecondary;
  const fill = tn === "up" ? color.profitWash : tn === "down" ? color.lossWash : t.sparkFlat;
  return (
    <Svg width={width - drawn.repaint} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Path d={area} fill={fill} />
      <Path d={line} fill="none" stroke={ink} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={[drawn.value * 4000, 4000]} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  turn: { transform: [{ rotate: "-90deg" }] },
  center: { alignItems: "center", justifyContent: "center" },
  gaugeText: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 19.2 },
  bar: { flexDirection: "row", overflow: "hidden", gap: 2, borderRadius: 9999, width: "100%" },
  warn: { borderWidth: 1, borderRadius: 9999, padding: 2, margin: -3 },
});
