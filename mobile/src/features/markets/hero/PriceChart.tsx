import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { ChartPoint } from "@/features/markets/hero/useChartSeries";
import { HERO } from "@/lib/copy";
import { FONT } from "~/theme";
import { clearTicks, layoutChart, toValue } from "../ticket/chart-scale";
import { useTk } from "../ticket/tk";

/** web's `.hero-chart-canvas` on a phone: 230 px — a 202 px pane over lightweight-charts' 28 px time axis, a 62 px price scale. */
export const HERO_CHART_HEIGHT = 230;
const TIME_AXIS = 28;
const SCALE_W = 62;
const LABEL_H = 18;
const FONT_SIZE = 12;
/** JetBrains Mono's advance at 12 px, for the titled line's box. */
const CHAR_W = 7.2;

/**
 * web's PriceChart (lightweight-charts, hero/PriceChart.client.tsx) drawn in SVG: the ink line at 2 px, hairline grid
 * at round prices with their labels on the right scale, the reference line (the opening print, or "prev close" on the
 * closed hero) with its titled label and boxed axis value, the last value boxed on the scale, and the clock along the
 * foot. The reference line joins the autoscale, as web's `includeInAutoscale` makes it.
 */
export function PriceChart({ points, openingRaw, lineLabel = HERO.openingPrint, height = HERO_CHART_HEIGHT }: { points: readonly ChartPoint[]; openingRaw: bigint | null; lineLabel?: string; height?: number }) {
  const tk = useTk();
  const [width, setWidth] = useState(0);
  const plotW = width - SCALE_W;
  const plotH = height - TIME_AXIS;
  const chart = layoutChart(points, openingRaw, plotW, plotH);
  const text = { fontFamily: FONT.dataRegular, fontSize: FONT_SIZE };
  const titleW = lineLabel.length * CHAR_W + 10;
  const axisLabel = (y: number, fill: string, ink: string, value: number) => (
    <>
      <Rect x={plotW} y={y - LABEL_H / 2} width={SCALE_W} height={LABEL_H} fill={fill} />
      <SvgText x={plotW + 8} y={y + 4} fill={ink} {...text}>
        {value.toFixed(2)}
      </SvgText>
    </>
  );
  return (
    <View style={[styles.canvas, { height }]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {chart ? (
        <Svg width={width} height={height}>
          {chart.ticks.map((tick) => (
            <Line key={`g${tick.value}`} x1={0} x2={plotW} y1={tick.y} y2={tick.y} stroke={tk.chartGrid} strokeWidth={1} />
          ))}
          {clearTicks(chart, LABEL_H).map((tick) => (
            <SvgText key={`t${tick.value}`} x={plotW + 8} y={tick.y + 4} fill={tk.chartText} {...text}>
              {tick.value.toFixed(2)}
            </SvgText>
          ))}
          {chart.refY !== null ? <Line x1={0} x2={plotW} y1={chart.refY} y2={chart.refY} stroke={tk.chartPriceLine} strokeWidth={1} /> : null}
          <Path d={chart.path} stroke={tk.chartLine} strokeWidth={2} fill="none" strokeLinejoin="round" />
          {chart.refY !== null && openingRaw !== null ? (
            <>
              <Rect x={plotW - titleW - 2} y={chart.refY - LABEL_H / 2} width={titleW} height={LABEL_H} fill={tk.chartPriceLine} />
              <SvgText x={plotW - 7} y={chart.refY + 4} fill={tk.chartPriceLabelInk} textAnchor="end" {...text}>
                {lineLabel}
              </SvgText>
              {axisLabel(chart.refY, tk.chartPriceLine, tk.chartPriceLabelInk, toValue(openingRaw))}
            </>
          ) : null}
          {axisLabel(chart.last.y, tk.chartLine, tk.chartLineLabelInk, chart.last.value)}
          {chart.times.map((time) => (
            <SvgText key={time.x} x={time.x} y={plotH + 18} fill={tk.chartText} textAnchor="middle" fontWeight={time.major ? "700" : "400"} {...text}>
              {time.label}
            </SvgText>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  canvas: { width: "100%" },
});
