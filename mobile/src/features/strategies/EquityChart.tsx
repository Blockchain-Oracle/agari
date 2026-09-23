import { formatBaseUnits } from "@agari/core/units";
import { useId, useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import { HISTORY } from "@/features/markets/history/copy";
import { haptic } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import type { StrategyWire } from "@/features/strategies/protocol";

type Curve = StrategyWire["record"]["curve"];

interface Point {
  atMs: number | null;
  cumBase: bigint;
}

/** The seed at zero, then one step per settled copy-trade, as web's RecordCard builds its EquityPoint list. */
function seriesOf(curve: Curve): Point[] {
  return [{ atMs: null, cumBase: 0n }, ...curve.map((p) => ({ atMs: p.atSec * 1000, cumBase: BigInt(p.cumBase) }))];
}

function geometry(points: readonly Point[], width: number, height: number, pad: number) {
  let low = points.reduce((min, p) => (p.cumBase < min ? p.cumBase : min), 0n);
  let high = points.reduce((max, p) => (p.cumBase > max ? p.cumBase : max), 0n);
  if (high === low) {
    high += 1n;
    low -= 1n;
  }
  const span = Number(high - low);
  const last = points.length - 1;
  const x = (i: number) => pad + (i / last) * (width - pad * 2);
  const y = (v: bigint) => pad + (1 - Number(v - low) / span) * (height - pad * 2);
  const line = `M ${points.map((p, i) => `${x(i).toFixed(2)},${y(p.cumBase).toFixed(2)}`).join(" L ")}`;
  const zeroY = y(0n);
  const area = `${line} L ${x(last).toFixed(2)},${zeroY.toFixed(2)} L ${x(0).toFixed(2)},${zeroY.toFixed(2)} Z`;
  return { x, y, line, area, zeroY };
}

/**
 * web's EquitySparkline (features/markets/history/EquitySparkline.tsx): cumulative net, oldest to newest, rising on
 * wins and dropping on losses, the drawdown drawn and never hidden. `interactive` adds a finger scrub that reads
 * each settled step's running total and time.
 */
export function EquityChart({ curve, decimals, symbol, height = 72, interactive = false }: {
  curve: Curve;
  decimals: number;
  symbol: string;
  height?: number;
  interactive?: boolean;
}) {
  const { color } = useTheme();
  const gradient = `eq-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [width, setWidth] = useState(0);
  const [focus, setFocus] = useState<number | null>(null);
  const points = seriesOf(curve);
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));

  if (points.length < 2) {
    return (
      <View style={[styles.empty, { height, borderColor: color.hairline }]}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{HISTORY.summary.curveEmpty}</Text>
      </View>
    );
  }

  const last = points[points.length - 1]!;
  const up = last.cumBase >= 0n;
  const ink = up ? color.accent : color.inkSecondary;
  const shown = focus === null ? last : points[focus]!;
  const abs = (v: bigint) => formatBaseUnits(v < 0n ? -v : v, decimals);
  const pick = (touchX: number) => {
    if (width === 0) return;
    const index = Math.round((touchX / width) * (points.length - 1));
    const clamped = Math.max(0, Math.min(points.length - 1, index));
    setFocus((prev) => {
      if (prev !== clamped) haptic.select();
      return clamped;
    });
  };
  const pan = Gesture.Pan()
    .runOnJS(true)
    .activateAfterLongPress(120)
    .onBegin((e) => pick(e.x))
    .onUpdate((e) => pick(e.x))
    .onFinalize(() => setFocus(null));

  const chart = width > 0 ? geometry(points, width, height, 4) : null;
  const drawing = chart ? (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={ink} stopOpacity={0.22} />
          <Stop offset="1" stopColor={ink} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Line x1={4} x2={width - 4} y1={chart.zeroY} y2={chart.zeroY} stroke={color.borderStrong} strokeDasharray="2 3" strokeWidth={1} />
      <Path d={chart.area} fill={`url(#${gradient})`} />
      <Path d={chart.line} fill="none" stroke={ink} strokeWidth={1.8} strokeLinejoin="round" strokeLinecap="round" />
      {focus !== null ? (
        <Line x1={chart.x(focus)} x2={chart.x(focus)} y1={0} y2={height} stroke={color.inkMuted} strokeWidth={1} />
      ) : null}
      <Circle cx={chart.x(focus ?? points.length - 1)} cy={chart.y(shown.cumBase)} r={3} fill={ink} />
      <Circle cx={chart.x(focus ?? points.length - 1)} cy={chart.y(shown.cumBase)} r={6} fill="none" stroke={ink} strokeOpacity={0.4} />
    </Svg>
  ) : null;

  return (
    <View style={styles.wrap} accessible accessibilityLabel={HISTORY.summary.curveLabel(up ? "up" : "down", `${abs(last.cumBase)} ${symbol}`)}>
      {interactive ? (
        <View style={styles.readout}>
          <Text style={[TYPE.dataLg, { color: shown.cumBase >= 0n ? color.accent : color.inkSecondary }]}>
            {shown.cumBase >= 0n ? "+" : "−"}
            {abs(shown.cumBase)} {symbol}
          </Text>
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>
            {shown.atMs === null ? "start" : focus === null ? "net so far" : new Date(shown.atMs).toLocaleString()}
          </Text>
        </View>
      ) : null}
      {interactive ? (
        <GestureDetector gesture={pan}>
          <View onLayout={onLayout} style={{ height }}>
            {drawing}
          </View>
        </GestureDetector>
      ) : (
        <View onLayout={onLayout} style={{ height }}>
          {drawing}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  readout: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  empty: { borderWidth: StyleSheet.hairlineWidth, borderStyle: "dashed", borderRadius: 8, alignItems: "center", justifyContent: "center" },
});
