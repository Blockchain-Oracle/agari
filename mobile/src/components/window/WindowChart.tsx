import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import Svg, { Defs, Line, LinearGradient, Path, Stop } from "react-native-svg";
import type { ChartPoint } from "@/features/markets/hero/useChartSeries";
import { useTheme } from "~/theme";

/**
 * The Window's live line against its strike (the opening print, dashed): the line in the side that is winning,
 * a wash under it. Plot coordinates are display-only floats; every amount stays a bigint upstream.
 */
export function WindowChart({ points, strikeRaw, height = 220 }: { points: ChartPoint[]; strikeRaw: bigint | null; height?: number }) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);
  if (points.length < 2 || width === 0) return <View style={{ height }} onLayout={onLayout} />;

  const values = points.map((p) => Number(p.valueRaw));
  const strike = strikeRaw === null ? null : Number(strikeRaw);
  const lo = Math.min(...values, strike ?? Infinity);
  const hi = Math.max(...values, strike ?? -Infinity);
  const span = hi - lo || 1;
  const pad = 10;
  const t0 = points[0]!.timeSec;
  const tSpan = points.at(-1)!.timeSec - t0 || 1;
  const x = (t: number) => ((t - t0) / tSpan) * width;
  const y = (v: number) => pad + (1 - (v - lo) / span) * (height - pad * 2);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(p.timeSec).toFixed(1)},${y(Number(p.valueRaw)).toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = values.at(-1)!;
  const up = strike === null || last >= strike;
  const ink = up ? color.profit : color.loss;

  return (
    <View style={{ height }} onLayout={onLayout} accessibilityLabel={up ? "Above the opening print" : "Below the opening print"}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={ink} stopOpacity={0.22} />
            <Stop offset="1" stopColor={ink} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={area} fill="url(#wash)" />
        {strike !== null ? <Line x1={0} x2={width} y1={y(strike)} y2={y(strike)} stroke={color.inkMuted} strokeWidth={1} strokeDasharray="4 5" /> : null}
        <Path d={line} stroke={ink} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
      </Svg>
    </View>
  );
}
