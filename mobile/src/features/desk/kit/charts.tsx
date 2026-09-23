import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import Animated, { Easing, useAnimatedProps, useReducedMotion, useSharedValue, withTiming } from "react-native-reanimated";
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from "react-native-svg";
import { useTheme } from "~/theme";

/**
 * The desk kit's small charts, ported from web/src/components/ui/desk-kit/charts.tsx (21st Traffic Source Donut
 * #29204, Partition Bar #26545, Progress radial #3424, Mini Chart #9613) to react-native-svg and Reanimated.
 */
export interface Slice {
  id: string;
  label: string;
  /** Any unit; slices are drawn as shares of the sum. */
  value: number;
  color: string;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const EASE = Easing.bezier(0.22, 1, 0.36, 1);

/** One arc of a ring, drawing in from zero on mount and gliding when its length changes. */
function Arc({ size, r, stroke, color, length, start, circumference, round }: { size: number; r: number; stroke: number; color: string; length: number; start: number; circumference: number; round?: boolean }) {
  const reduce = useReducedMotion();
  const drawn = useSharedValue(reduce ? length : 0);
  useEffect(() => {
    drawn.value = reduce ? length : withTiming(length, { duration: 600, easing: EASE });
  }, [length, reduce, drawn]);
  const props = useAnimatedProps(() => ({ strokeDasharray: [drawn.value, circumference] }));
  return (
    <AnimatedCircle
      cx={size / 2}
      cy={size / 2}
      r={r}
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap={round ? "round" : "butt"}
      strokeDashoffset={-start}
      animatedProps={props}
    />
  );
}

/** web's Donut: a ring of slices with a figure in the middle. */
export function Donut({ slices, size = 160, thickness = 16, children, label }: { slices: readonly Slice[]; size?: number; thickness?: number; children?: ReactNode; label: string }) {
  const { color } = useTheme();
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
        {total > 0 ? arcs.map((a) => <Arc key={a.id} size={size} r={r} stroke={thickness} color={a.color} length={a.length} start={a.start} circumference={c} />) : null}
      </Svg>
      {children ? <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View> : null}
    </View>
  );
}

/** web's RadialGauge: 0–100, tinted by how close it is to full unless a tone is given. */
export function RadialGauge({ value, size = 64, stroke = 6, tone, children, label }: { value: number; size?: number; stroke?: number; tone?: "accent" | "warn" | "loss" | "profit"; children?: ReactNode; label: string }) {
  const { color } = useTheme();
  const clamped = Math.max(0, Math.min(100, value));
  const picked = tone ?? (clamped >= 90 ? "loss" : clamped >= 70 ? "warn" : "accent");
  const ink = { accent: color.accent, warn: color.warning, loss: color.loss, profit: color.profit }[picked];
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size }} accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped) }}>
      <Svg width={size} height={size} style={[StyleSheet.absoluteFill, styles.turn]}>
        <Circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color.hairline} strokeWidth={stroke} />
        {clamped > 0 ? <Arc size={size} r={r} stroke={stroke} color={ink} length={(clamped / 100) * c} start={0} circumference={c} round /> : null}
      </Svg>
      {children ? <View style={[StyleSheet.absoluteFill, styles.center]}>{children}</View> : null}
    </View>
  );
}

/** web's PartitionBar: one bar split into slices; warns in the loss ink while the parts do not add up. */
export function PartitionBar({ slices, height = 12, warn = false, label }: { slices: readonly Slice[]; height?: number; warn?: boolean; label: string }) {
  const { color } = useTheme();
  const shown = slices.filter((s) => s.value > 0);
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}
      style={[styles.bar, { height, borderRadius: height / 2, backgroundColor: color.surface2, borderColor: warn ? color.loss : "transparent" }]}
    >
      {shown.map((s) => (
        <View key={s.id} style={{ flexGrow: s.value, flexBasis: 0, backgroundColor: s.color }} />
      ))}
    </View>
  );
}

/** A Sparkline as wide as its container. */
export function FillSparkline({ values, height = 44 }: { values: readonly number[]; height?: number }) {
  const [width, setWidth] = useState(0);
  return (
    <View style={{ height }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {width > 0 ? <Sparkline values={values} width={width} height={height} /> : null}
    </View>
  );
}

/** web's Sparkline: a tiny line with a soft fill; one point draws nothing. */
export function Sparkline({ values, width = 96, height = 28, tone }: { values: readonly number[]; width?: number; height?: number; tone?: "up" | "down" | "flat" }) {
  const { color } = useTheme();
  if (values.length < 2) return <View style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [(i / (values.length - 1)) * width, height - 2 - ((v - min) / span) * (height - 4)] as const);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const first = values[0] ?? 0;
  const last = values.at(-1) ?? 0;
  const t = tone ?? (last > first ? "up" : last < first ? "down" : "flat");
  const ink = t === "up" ? color.profit : t === "down" ? color.loss : color.inkSecondary;
  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <Defs>
        <LinearGradient id="spark" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={ink} stopOpacity={0.22} />
          <Stop offset="1" stopColor={ink} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={area} fill="url(#spark)" />
      <Path d={line} fill="none" stroke={ink} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

const styles = StyleSheet.create({
  turn: { transform: [{ rotate: "-90deg" }] },
  center: { alignItems: "center", justifyContent: "center" },
  bar: { flexDirection: "row", overflow: "hidden", gap: 2, borderWidth: 1 },
});
