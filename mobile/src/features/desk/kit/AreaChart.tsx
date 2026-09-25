import { useMemo, useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import Svg, { Defs, Line, LinearGradient, Path, Rect, Text as SvgText } from "react-native-svg";
import { Stop, stopPaint } from "~/components/ui/SvgStop";
import { haptic } from "~/components/kit";
import { FONT } from "~/theme";
import { useDeskTheme } from "./theme";

/** A point on the chart; values are dollars, floats only at this display edge (the money stays bigint upstream). */
export interface AreaPoint {
  timeSec: number;
  value: number;
}

/** lightweight-charts' layout as web configures it: a 66 px price scale on the right, a 28 px time scale below. */
const AXIS_W = 66;
const TIME_H = 28;
const MARGIN = { top: 0.18, bottom: 0.08 };
const HOUR = 3_600;
const STEPS_SEC = [HOUR, 3 * HOUR, 6 * HOUR, 12 * HOUR, 24 * HOUR, 2 * 24 * HOUR, 7 * 24 * HOUR];

function niceStep(span: number, want: number): number {
  const raw = span / want;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const n = raw / mag;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
}

const price = (v: number): string => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
const two = (n: number) => String(n).padStart(2, "0");
function timeLabel(sec: number): string {
  const d = new Date(sec * 1000);
  return d.getHours() === 0 && d.getMinutes() === 0 ? String(d.getDate()) : `${two(d.getHours())}:${two(d.getMinutes())}`;
}

/**
 * The desk's value chart (web's AreaChart.client.tsx, lightweight-charts as the cockpit configures it): the value at
 * every check as an area in the move's tone (line 2 px, fill 28% fading out), horizontal grid lines on the price
 * scale, the baseline (what went in) as a dashed rule, the last value boxed on the scale, the time scale below, and a
 * magnet crosshair under the finger.
 */
export function AreaChart({ points, baseline, tone, height = 224, label }: { points: readonly AreaPoint[]; baseline: number | null; tone: "up" | "down" | "flat"; height?: number; label: string }) {
  const { color } = useDeskTheme();
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  const ink = tone === "up" ? color.profit : tone === "down" ? color.loss : color.ink;
  const plotW = Math.max(1, width - AXIS_W);
  const plotH = height - TIME_H;

  const geo = useMemo(() => {
    const values = points.map((p) => p.value);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const range = hi - lo || Math.max(hi * 0.01, 0.01);
    const usable = plotH * (1 - MARGIN.top - MARGIN.bottom);
    const max = hi + (range * MARGIN.top * plotH) / usable;
    const min = lo - (range * MARGIN.bottom * plotH) / usable;
    const t0 = points[0]?.timeSec ?? 0;
    const t1 = points.at(-1)?.timeSec ?? 1;
    const x = (sec: number) => ((sec - t0) / Math.max(1, t1 - t0)) * plotW;
    const y = (v: number) => (1 - (v - min) / (max - min || 1)) * plotH;
    const xs = points.map((p) => x(p.timeSec));
    const ys = points.map((p) => y(p.value));
    const line = xs.map((px, i) => `${i === 0 ? "M" : "L"}${px.toFixed(1)},${ys[i]!.toFixed(1)}`).join(" ");
    const area = `${line} L${xs.at(-1)?.toFixed(1)},${plotH} L${xs[0]?.toFixed(1)},${plotH} Z`;
    const step = niceStep(max - min, 4);
    const ticks: number[] = [];
    for (let v = Math.ceil(min / step) * step; v <= max; v += step) ticks.push(v);
    const tStep = STEPS_SEC.find((s) => (t1 - t0) / s <= 4) ?? 14 * 24 * HOUR;
    const offset = -new Date(t0 * 1000).getTimezoneOffset() * 60;
    const times: number[] = [];
    for (let s = Math.ceil((t0 + offset) / tStep) * tStep - offset; s <= t1; s += tStep) times.push(s);
    return { xs, ys, line, area, ticks, times, x, y };
  }, [points, plotW, plotH]);

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

  const lastY = geo.ys.at(-1) ?? 0;
  const hy = hover !== null ? geo.ys[hover]! : null;
  const labelBox = (yy: number, text: string, bg: string, fg: string) => (
    <>
      <Rect x={plotW} y={yy - 10} width={AXIS_W} height={20} fill={bg} />
      <SvgText x={plotW + 8} y={yy + 4.5} fill={fg} fontFamily={FONT.body} fontSize={12}>
        {text}
      </SvgText>
    </>
  );
  return (
    <GestureDetector gesture={scrub}>
      <View style={{ height }} onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)} accessible accessibilityRole="image" accessibilityLabel={label}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <Defs>
              <LinearGradient id="desk-area" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" {...stopPaint(ink, 0.28)} />
                <Stop offset="1" {...stopPaint(ink, 0)} />
              </LinearGradient>
            </Defs>
            {geo.ticks.map((v) => (
              <Line key={`g${v}`} x1={0} x2={plotW} y1={geo.y(v)} y2={geo.y(v)} stroke={color.hairline} strokeWidth={1} />
            ))}
            {geo.ticks.map((v) => (
              <SvgText key={`p${v}`} x={plotW + 8} y={geo.y(v) + 4.5} fill={color.inkMuted} fontFamily={FONT.body} fontSize={12}>
                {price(v)}
              </SvgText>
            ))}
            {geo.times.map((s) => (
              <SvgText key={`t${s}`} x={geo.x(s)} y={plotH + 18} fill={color.inkMuted} fontFamily={FONT.body} fontSize={12} textAnchor="middle">
                {timeLabel(s)}
              </SvgText>
            ))}
            {baseline !== null ? <Line x1={0} x2={plotW} y1={geo.y(baseline)} y2={geo.y(baseline)} stroke={color.inkMuted} strokeWidth={1} strokeDasharray={[6, 6]} /> : null}
            <Path d={geo.area} fill="url(#desk-area)" />
            <Path d={geo.line} fill="none" stroke={ink} strokeWidth={2} strokeLinejoin="round" />
            {labelBox(lastY, price(points.at(-1)?.value ?? 0), ink, color.onAccent)}
            {hover !== null && hy !== null ? (
              <>
                <Line x1={geo.xs[hover]} x2={geo.xs[hover]} y1={0} y2={plotH} stroke={color.inkMuted} strokeWidth={1} strokeDasharray={[1, 3]} />
                <Line x1={0} x2={plotW} y1={hy} y2={hy} stroke={color.inkMuted} strokeWidth={1} strokeDasharray={[1, 3]} />
                {labelBox(hy, price(points[hover]!.value), color.surface2, color.ink)}
                <Rect x={geo.xs[hover]! - 4} y={hy - 4} width={8} height={8} rx={4} fill={ink} stroke={color.surface1} strokeWidth={2} />
              </>
            ) : null}
          </Svg>
        ) : null}
      </View>
    </GestureDetector>
  );
}
