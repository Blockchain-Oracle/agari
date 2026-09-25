import { useId, useState } from "react";
import { Easing, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import { useReducedMotion } from "react-native-reanimated";
import Svg, { Circle, ClipPath, Defs, Line, LinearGradient, Path, Rect } from "react-native-svg";
import { Stop, stopPaint } from "~/components/ui/SvgStop";
import type { ChartPoint } from "@/features/markets/hero/useChartSeries";
import { assetPriceLine } from "@/features/markets/hero/units";
import { HERO } from "@/lib/copy";
import { FONT, RADIUS, useTheme } from "~/theme";
import { loopAt, svgRepaint, useSvgClock } from "~/components/ui/svg-clock";
import { plotSeries } from "./plot";


interface Props {
  points: readonly ChartPoint[];
  /** The opening print the Window settles against; null while pending, when no line is drawn at a guessed level. */
  strikeRaw: bigint | null;
  /** The asset the figures are about (a basket reads in points). */
  asset: string;
  height?: number;
  /** The Window's own span, so the line grows toward the bell; omitted, the samples fill the width. */
  domain?: { fromSec: number; toSec: number } | null;
  /** The reference line's name ("opening print", or "prev close" on a closed asset chart). */
  lineLabel?: string;
  /** Hide the figure pills (a card-sized line). */
  bare?: boolean;
}

/**
 * The Window's live line against its strike — web's hero PriceChart (lightweight-charts) drawn natively: the price
 * since open, the dashed opening print, green while UP is winning and red below it, the band between them washed in
 * the same ink, and a pulsing head on the newest print (still under Reduce Motion).
 */
export function LiveLine({ points, strikeRaw, asset, height = 220, domain = null, lineLabel = HERO.openingPrint, bare = false }: Props) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const reduce = useReducedMotion();
  const onLayout = (event: LayoutChangeEvent) => setWidth(Math.round(event.nativeEvent.layout.width));
  const plot = plotSeries(points, strikeRaw, { width, height, padY: bare ? 4 : 14, domain });

  if (!plot) {
    return <View style={{ height }} onLayout={onLayout} />;
  }

  const strikeY = plot.strikeY;
  const newest = points.at(-1)!;
  const tone = plot.winning ? color.profit : color.loss;
  // The band between the line and the strike: washed green where it sits above, red where below.
  const areaBand = strikeY === null ? null : `${plot.path} L${plot.last.x.toFixed(1)},${strikeY.toFixed(1)} L${plot.first.x.toFixed(1)},${strikeY.toFixed(1)} Z`;

  return (
    <View style={{ height }} onLayout={onLayout} accessibilityLabel={HERO.chartLabel(asset, strikeRaw === null ? "—" : assetPriceLine(asset, strikeRaw), assetPriceLine(asset, newest.valueRaw))}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={`up${uid}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" {...stopPaint(color.profit, 0.28)} />
            <Stop offset="1" {...stopPaint(color.profit, 0.02)} />
          </LinearGradient>
          <LinearGradient id={`down${uid}`} x1="0" y1="1" x2="0" y2="0">
            <Stop offset="0" {...stopPaint(color.loss, 0.28)} />
            <Stop offset="1" {...stopPaint(color.loss, 0.02)} />
          </LinearGradient>
          {strikeY !== null ? (
            <>
              <ClipPath id={`above${uid}`}>
                <Rect x={0} y={0} width={width} height={Math.max(strikeY, 0)} />
              </ClipPath>
              <ClipPath id={`below${uid}`}>
                <Rect x={0} y={strikeY} width={width} height={Math.max(height - strikeY, 0)} />
              </ClipPath>
            </>
          ) : null}
        </Defs>
        {strikeY !== null && areaBand ? (
          <>
            <Path d={areaBand} fill={`url(#up${uid})`} clipPath={`url(#above${uid})`} />
            <Path d={areaBand} fill={`url(#down${uid})`} clipPath={`url(#below${uid})`} />
            <Line x1={0} x2={width} y1={strikeY} y2={strikeY} stroke={color.inkSecondary} strokeWidth={1} strokeDasharray="5 5" />
            <Path d={plot.path} stroke={color.profit} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#above${uid})`} />
            <Path d={plot.path} stroke={color.loss} strokeWidth={2.2} fill="none" strokeLinejoin="round" strokeLinecap="round" clipPath={`url(#below${uid})`} />
          </>
        ) : (
          <Path d={plot.path} stroke={color.ink} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
        )}
        <PulseHead x={plot.last.x} y={plot.last.y} ink={strikeY === null ? color.ink : tone} />
      </Svg>
      {reduce ? null : <PulseRing x={plot.last.x} y={plot.last.y} ink={strikeY === null ? color.ink : tone} />}
      {!bare && strikeY !== null && strikeRaw !== null ? (
        <View style={[styles.strikeTag, { top: Math.min(Math.max(strikeY - 22, 0), height - 20), backgroundColor: color.ground, borderColor: color.hairline }]}>
          <Text style={[styles.tagText, { color: color.inkSecondary }]}>
            {lineLabel} {assetPriceLine(asset, strikeRaw)}
          </Text>
        </View>
      ) : null}
      {!bare ? (
        <View style={[styles.lastTag, { top: Math.min(Math.max(plot.last.y - 10, 0), height - 20), backgroundColor: strikeY === null ? color.ink : tone }]}>
          <Text style={[styles.tagText, { color: color.ground }]}>{assetPriceLine(asset, newest.valueRaw)}</Text>
        </View>
      ) : null}
    </View>
  );
}

/** The newest print: a solid dot inside the chart. */
function PulseHead({ x, y, ink }: { x: number; y: number; ink: string }) {
  return <Circle cx={x} cy={y} r={4} fill={ink} />;
}

const RING = 28;
const PULSE_OUT = Easing.out(Easing.quad);

/**
 * The ring that breathes out from the newest print, in its own small Svg over the chart so only it redraws each frame
 * (react-native-svg repaints on layout, not on a child's prop change: see `useSvgClock`).
 */
function PulseRing({ x, y, ink }: { x: number; y: number; ink: string }) {
  const ms = useSvgClock();
  const p = PULSE_OUT(loopAt(ms, 1400));
  return (
    <Svg pointerEvents="none" width={RING - svgRepaint(ms)} height={RING} style={[styles.ring, { left: x - RING / 2, top: y - RING / 2 }]}>
      <Circle cx={RING / 2} cy={RING / 2} r={4 + p * 10} fill={ink} opacity={0.45 * (1 - p)} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  ring: { position: "absolute" },
  strikeTag: { position: "absolute", left: 0, paddingHorizontal: 6, height: 20, borderRadius: RADIUS.sm, borderWidth: StyleSheet.hairlineWidth, justifyContent: "center" },
  lastTag: { position: "absolute", right: 0, paddingHorizontal: 6, height: 20, borderRadius: RADIUS.sm, justifyContent: "center" },
  tagText: { fontFamily: FONT.data, fontSize: 11, fontVariant: ["tabular-nums"] },
});
