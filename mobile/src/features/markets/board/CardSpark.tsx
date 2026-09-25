import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Defs, G, Line, LinearGradient, Path, Rect } from "react-native-svg";
import { Stop, stopPaint } from "~/components/ui/SvgStop";
import type { ChartPoint } from "@/features/markets/hero/useChartSeries";
import { LANE_CARD } from "@/lib/copy";
import { FONT, useTheme } from "~/theme";
import { lanesTokens } from "~/theme/web/markets-lanes";
import { card } from "./card-styles";

/** Half the `.strike-tick` chip: the plot band keeps 8 px clear of the box's top and bottom, so the rule and its "line"
 *  chip never land on an edge the box clips (web 95f7fe45). */
const PAD = 8;

interface Plot {
  /** Points in the box's own pixels. */
  path: string;
  /** Where the opening print sits, top-down, in pixels. */
  strikeY: number | null;
  /** UP is winning — the price at or above the line; with no line yet, the series' own direction. */
  winning: boolean;
}

/** web CardSpark's `plot`, fitted to the measured box: the band widens to take in the opening print. */
function plot(points: readonly ChartPoint[], openingRaw: bigint | null, width: number, height: number): Plot | null {
  if (points.length < 2 || width === 0) return null;
  const values = points.map((point) => point.valueRaw);
  let low = values.reduce((a, b) => (a < b ? a : b));
  let high = values.reduce((a, b) => (a > b ? a : b));
  if (openingRaw !== null) {
    if (openingRaw < low) low = openingRaw;
    if (openingRaw > high) high = openingRaw;
  }
  const span = high - low;
  const y = (value: bigint): number => (span === 0n ? height / 2 : height - (Number(((value - low) * 1000n) / span) / 1000) * height);
  const x = (index: number): number => (index / (points.length - 1)) * width;
  const latest = points.at(-1)?.valueRaw ?? 0n;
  return {
    path: points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)},${y(point.valueRaw).toFixed(2)}`).join(" "),
    strikeY: openingRaw === null ? null : y(openingRaw),
    winning: openingRaw === null ? latest >= (points[0]?.valueRaw ?? 0n) : latest >= openingRaw,
  };
}

/**
 * web's `.mc-spark` with CardSpark inside (Masayume's `Spark624`): the 70 px box and its top-down wash, the line
 * coloured by which side of the line the price is on, and the dashed strike rule with its "line" tick at the right.
 */
export function CardSpark({ points, openingRaw }: { points: readonly ChartPoint[]; openingRaw: bigint | null }) {
  const { name } = useTheme();
  const t = lanesTokens(name);
  const [width, setWidth] = useState(0);
  const height = card.spark.height;
  const shape = plot(points, openingRaw, width, height - 2 * PAD);
  const strikeY = shape?.strikeY == null ? null : PAD + shape.strikeY;
  return (
    <View style={card.spark} onLayout={(event) => setWidth(event.nativeEvent.layout.width)} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg style={StyleSheet.absoluteFill} width={width} height={height}>
        <Defs>
          <LinearGradient id="mcSparkWash" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" {...stopPaint(t.sparkWash)} />
            <Stop offset="1" {...stopPaint(t.sparkWashEnd)} />
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width={width} height={height} fill="url(#mcSparkWash)" />
        {shape ? (
          <G transform={`translate(0, ${PAD})`}>
            <Path d={shape.path} fill="none" stroke={shape.winning ? t.profit : t.loss} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
          </G>
        ) : null}
        {strikeY !== null ? <Line x1={0} x2={width} y1={strikeY + 0.5} y2={strikeY + 0.5} stroke={t.vermilion} strokeWidth={1} strokeDasharray="3,3" /> : null}
      </Svg>
      {strikeY !== null ? (
        <Text style={[styles.tick, { top: strikeY - 7.4, color: t.vermilion, backgroundColor: t.strikeTickBg }]}>{LANE_CARD.line}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tick: { position: "absolute", right: 6, paddingVertical: 1, paddingHorizontal: 4, borderRadius: 2, overflow: "hidden", fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 12.8, letterSpacing: 0.48 },
});
