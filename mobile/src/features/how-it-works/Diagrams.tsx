import { useEffect, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import Svg, { Circle, Line, Rect, Text as SvgText } from "react-native-svg";
import { HOW_IT_WORKS } from "@/features/how-it-works/copy";
import { LANES } from "@/features/how-it-works/sessions";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

const EX = HOW_IT_WORKS.example;
/** The worked example's own figures (web Steps.tsx: 64¢ / 36¢ / 1.00) — an illustration, labelled as one. */
const UP_CENTS = 64;

/**
 * web Steps.tsx's payout example (64¢ · 36¢ · 1.00) drawn as what it says: one dollar split between the two sides of
 * the book, the UP share growing in on arrival. The tag above it says it is a worked example, not a live quote.
 */
export function PayoutSplit() {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const grow = useSharedValue(reduce ? 1 : 0);
  useEffect(() => {
    if (!reduce) grow.value = withDelay(200, withTiming(1, { duration: 700 }));
  }, [reduce, grow]);
  const upStyle = useAnimatedStyle(() => ({ flex: UP_CENTS * grow.value + 0.001 }));
  return (
    <View style={styles.split} accessible accessibilityLabel={`${EX.up} 64 cents plus ${EX.down} 36 cents equals ${EX.max} 1.00`}>
      <View style={[styles.bar, { borderColor: color.hairline }]}>
        <Animated.View style={[styles.seg, { backgroundColor: color.profit }, upStyle]}>
          <Text style={[TYPE.data, styles.segText, { color: color.ground }]}>UP 64¢</Text>
        </Animated.View>
        <View style={[styles.seg, { flex: 100 - UP_CENTS, backgroundColor: color.loss }]}>
          <Text style={[TYPE.data, styles.segText, { color: color.ground }]}>36¢</Text>
        </View>
      </View>
      <View style={styles.figures}>
        <Figure value="64¢" label={EX.up} ink={color.profit} />
        <Figure value="36¢" label={EX.down} ink={color.loss} />
        <Figure value="1.00" label={EX.max} ink={color.ink} />
      </View>
    </View>
  );
}

function Figure({ value, label, ink }: { value: string; label: string; ink: string }) {
  const { color } = useTheme();
  return (
    <View style={styles.figure}>
      <Text style={[TYPE.dataLg, { color: ink }]}>{value}</Text>
      <Text style={[TYPE.caption, styles.figureLabel, { color: color.inkMuted }]}>{label}</Text>
    </View>
  );
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const OPEN_H = 9.5;
const CLOSE_H = 16;
const GAP_LOCK_H = 20;
const ROW_H = 22;
const ROW_GAP = 12;
const LABEL_W = 62;
const AXIS_H = 18;

/**
 * sessions.ts LANES as a week on the NYSE clock (ET): Regular 09:30–16:00 on weekdays, the Gap from Friday's close to
 * Monday's open (locking Sunday 20:00), and the Token lane around the clock — the three facts drawn to scale.
 */
export function WeekStrip() {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const plot = Math.max(0, width - LABEL_W);
  const day = plot / 7;
  const x = (d: number, h: number) => LABEL_W + d * day + (h / 24) * day;
  const rowY = (row: number) => AXIS_H + row * (ROW_H + ROW_GAP);
  const height = rowY(3) - ROW_GAP + 4;
  const lanes = LANES.map((lane) => lane.name);

  const regular = [0, 1, 2, 3, 4].map((d) => ({ x1: x(d, OPEN_H), x2: x(d, CLOSE_H) }));
  const gap = [
    { x1: x(4, CLOSE_H), x2: x(6, 24) },
    { x1: x(0, 0), x2: x(0, OPEN_H) },
  ];

  return (
    <View onLayout={onLayout} accessible accessibilityLabel="A week on the NYSE clock: Regular Windows 09:30 to 16:00 ET on weekdays; the Gap from Friday's close to Monday's open, locking Sunday 20:00; the Token lane every hour of every day.">
      {width > 0 ? (
        <Svg width={width} height={height}>
          {DAYS.map((name, d) => (
            <SvgText key={name} x={x(d, 12)} y={11} fill={color.inkMuted} fontFamily={FONT.data} fontSize={9.5} textAnchor="middle">
              {name}
            </SvgText>
          ))}
          {DAYS.map((name, d) => (
            <Line key={`r-${name}`} x1={x(d, 0)} x2={x(d, 0)} y1={AXIS_H - 2} y2={height} stroke={color.hairline} strokeWidth={1} />
          ))}
          {lanes.map((name, row) => (
            <SvgText key={name} x={0} y={rowY(row) + 15} fill={color.ink} fontFamily={FONT.bodyStrong} fontSize={12}>
              {name}
            </SvgText>
          ))}
          {regular.map((seg) => (
            <Rect key={seg.x1} x={seg.x1} y={rowY(0)} width={seg.x2 - seg.x1} height={ROW_H} rx={3} fill={color.accent} />
          ))}
          {gap.map((seg) => (
            <Rect key={seg.x1} x={seg.x1} y={rowY(1)} width={seg.x2 - seg.x1} height={ROW_H} rx={3} fill={color.info} opacity={0.85} />
          ))}
          <Circle cx={x(6, GAP_LOCK_H)} cy={rowY(1) + ROW_H / 2} r={4} fill={color.ground} stroke={color.ink} strokeWidth={1.5} />
          <Rect x={x(0, 0)} y={rowY(2)} width={plot} height={ROW_H} rx={3} fill={color.profit} opacity={0.85} />
        </Svg>
      ) : (
        <View style={{ height: 110 }} />
      )}
      <Text style={[TYPE.caption, styles.legend, { color: color.inkMuted }]}>ET · ○ the Gap Window locks Sunday 20:00</Text>
    </View>
  );
}

/** web `hiw-formula`: the three identities of the book, set in mono on their own plate. */
export function Formula() {
  const { color } = useTheme();
  const lines = [HOW_IT_WORKS.formula.identity, HOW_IT_WORKS.formula.cost, HOW_IT_WORKS.formula.payout];
  return (
    <View style={[styles.formula, { backgroundColor: color.surface2, borderColor: color.hairline }]} accessibilityRole="text">
      {lines.map((line) => (
        <Text key={line} style={[TYPE.data, { color: color.ink }]}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  split: { gap: 14 },
  bar: { flexDirection: "row", height: 36, borderRadius: RADIUS.md, overflow: "hidden", borderWidth: StyleSheet.hairlineWidth },
  seg: { justifyContent: "center", paddingHorizontal: 10, overflow: "hidden" },
  segText: { fontSize: 12 },
  figures: { flexDirection: "row", gap: 8 },
  figure: { flex: 1, gap: 2 },
  figureLabel: { fontSize: 11.5, lineHeight: 15 },
  legend: { fontSize: 11.5, marginTop: 6 },
  formula: { borderRadius: RADIUS.md, borderWidth: StyleSheet.hairlineWidth, padding: 14, gap: 8 },
});
