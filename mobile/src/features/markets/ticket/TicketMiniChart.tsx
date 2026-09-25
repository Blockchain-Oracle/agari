import type { EventMarket } from "@agari/core/types";
import { useOpeningPrice } from "@agari/markets/react";
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Line, Path, Rect, Text as SvgText } from "react-native-svg";
import type { ChartPoint } from "@/features/markets/hero/useChartSeries";
import { useChartSeries } from "@/features/markets/hero/useChartSeries";
import { HERO } from "@/lib/copy";
import { ErrorState, LoadingState } from "~/components/kit";
import { FONT } from "~/theme";
import { layoutChart, toValue } from "./chart-scale";
import { useTk } from "./tk";

/** web's `.tk-mini-chart-canvas` is 128 px: a 100 px pane over lightweight-charts' 28 px time axis, a 62 px price scale. */
const HEIGHT = 128;
const TIME_AXIS = 28;
const SCALE_W = 62;
const LABEL_H = 18;
const FONT_SIZE = 12;

/**
 * web's TicketMiniChart: the drawer's live chart (the reference's `lg:hidden` 128 px canvas in a rounded box), drawn
 * only once there is a series to draw — the line, the round price ticks on the right with their hairline grid, the
 * opening print as a line with its titled label, the last value boxed on the scale, and the clock along the foot.
 */
export function TicketMiniChart({ market }: { market: EventMarket }) {
  const tk = useTk();
  const series = useChartSeries(market);
  const opening = useOpeningPrice(market.marketId);
  const openingRaw = opening?.ok ? opening.value : market.openingPriceRaw;
  if (series?.ok && series.value.points.length < 2) return null;
  return (
    <View style={[styles.box, { borderColor: tk.miniBorder, backgroundColor: tk.miniBg }]}>
      {series === null ? <LoadingState shape="chart" /> : !series.ok ? <ErrorState diagnosis={series.error} /> : <Canvas points={series.value.points} openingRaw={openingRaw} />}
    </View>
  );
}

function Canvas({ points, openingRaw }: { points: readonly ChartPoint[]; openingRaw: bigint | null }) {
  const tk = useTk();
  const [width, setWidth] = useState(0);
  const plotW = width - SCALE_W;
  const plotH = HEIGHT - TIME_AXIS;
  const chart = layoutChart(points, openingRaw, plotW, plotH);
  const text = { fontFamily: FONT.dataRegular, fontSize: FONT_SIZE };
  const axisLabel = (y: number, fill: string, ink: string, value: number) => (
    <>
      <Rect x={plotW} y={y - LABEL_H / 2} width={SCALE_W} height={LABEL_H} fill={fill} />
      <SvgText x={plotW + 8} y={y + 4} fill={ink} {...text}>
        {value.toFixed(2)}
      </SvgText>
    </>
  );
  return (
    <View style={styles.canvas} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {chart ? (
        <Svg width={width} height={HEIGHT}>
          {chart.ticks.map((tick) => (
            <Line key={`g${tick.value}`} x1={0} x2={plotW} y1={tick.y} y2={tick.y} stroke={tk.chartGrid} strokeWidth={1} />
          ))}
          {chart.ticks.map((tick) => (
            <SvgText key={`t${tick.value}`} x={plotW + 8} y={tick.y + 4} fill={tk.chartText} {...text}>
              {tick.value.toFixed(2)}
            </SvgText>
          ))}
          {chart.refY !== null ? <Line x1={0} x2={plotW} y1={chart.refY} y2={chart.refY} stroke={tk.chartPriceLine} strokeWidth={1} /> : null}
          <Path d={chart.path} stroke={tk.chartLine} strokeWidth={2} fill="none" strokeLinejoin="round" />
          {chart.refY !== null && openingRaw !== null ? (
            <>
              <Rect x={plotW - HERO.openingPrint.length * 7 - 8} y={chart.refY - LABEL_H / 2} width={HERO.openingPrint.length * 7 + 6} height={LABEL_H} fill={tk.chartPriceLine} />
              <SvgText x={plotW - 5} y={chart.refY + 4} fill={tk.chartPriceLabelInk} textAnchor="end" {...text}>
                {HERO.openingPrint}
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
  box: { marginBottom: 16, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  canvas: { height: HEIGHT, width: "100%" },
});
