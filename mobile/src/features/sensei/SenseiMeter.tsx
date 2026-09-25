import { formatClock } from "@agari/core/units";
import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import type { ChartPoint } from "@/features/markets/hero/useChartSeries";
import { assetPriceLine } from "@/features/markets/hero/units";
import { SENSEI_UI } from "@/features/sensei/copy";
import type { SenseiReading } from "@/features/sensei/useSenseiSnapshot";
import { LANE_CARD } from "@/lib/copy";
import { FONT, useTheme } from "~/theme";
import { senseiTokens } from "~/theme/web/explore/sensei";

const VIEW_W = 100;
const VIEW_H = 40;
/** `.sensei-meter .mc-spark` on a phone. */
const SPARK_H = 70;
/** web CardSpark's PAD_PX: half the "line" chip, kept clear top and bottom so the rule and chip never clip. */
const PAD = 8;
const BAND_H = SPARK_H - 2 * PAD;

/** web CardSpark's `plot`: the series fitted to the box, the band widened to hold the opening print. */
function plot(points: readonly ChartPoint[], openingRaw: bigint | null) {
  if (points.length < 2) return null;
  const values = points.map((point) => point.valueRaw);
  let low = values.reduce((a, b) => (a < b ? a : b));
  let high = values.reduce((a, b) => (a > b ? a : b));
  if (openingRaw !== null) {
    if (openingRaw < low) low = openingRaw;
    if (openingRaw > high) high = openingRaw;
  }
  const span = high - low;
  const y = (value: bigint): number => (span === 0n ? VIEW_H / 2 : VIEW_H - (Number(((value - low) * 1000n) / span) / 1000) * VIEW_H);
  const x = (index: number): number => (index / (points.length - 1)) * VIEW_W;
  const latest = points.at(-1)?.valueRaw ?? 0n;
  return {
    path: points.map((point, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(2)},${y(point.valueRaw).toFixed(2)}`).join(" "),
    strikeTop: openingRaw === null ? null : PAD + (y(openingRaw) / VIEW_H) * BAND_H,
    winning: openingRaw === null ? latest >= (points[0]?.valueRaw ?? 0n) : latest >= openingRaw,
  };
}

/** web's CardSpark in the meter's `.mc-spark`: the tape, the dashed strike rule and its "line" chip. */
function Spark({ points, openingRaw }: { points: readonly ChartPoint[]; openingRaw: bigint | null }) {
  const { name, color } = useTheme();
  const t = senseiTokens(name);
  const shape = plot(points, openingRaw);
  return (
    <LinearGradient colors={[t.sparkTop, t.sparkBottom]} style={styles.spark}>
      {shape ? (
        <>
          <Svg style={styles.band} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} preserveAspectRatio="none" accessible={false}>
            <Path d={shape.path} fill="none" stroke={shape.winning ? color.profit : color.loss} strokeWidth={1.25} vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
          </Svg>
          {shape.strikeTop !== null ? (
            <>
              <Svg style={[styles.strike, { top: shape.strikeTop }]} height={2} width="100%" accessible={false}>
                <Line x1={0} y1={0.5} x2="100%" y2={0.5} stroke={color.accent} strokeWidth={1} strokeDasharray="3 3" />
                <Line x1={0} y1={1.5} x2="100%" y2={1.5} stroke={t.strikeWash} strokeWidth={1} />
              </Svg>
              <View style={[styles.tick, { top: shape.strikeTop - 7.4, backgroundColor: t.strikeChip }]}>
                <Text style={[styles.tickText, { color: color.accent }]}>{LANE_CARD.line}</Text>
              </View>
            </>
          ) : null}
        </>
      ) : null}
    </LinearGradient>
  );
}

/**
 * web's `SenseiMeter` (SenseiDrawer.tsx): the pinned strip every reply sits under — the nearest Window's price, the
 * drift triangle and move over the span actually held, the time left (vermilion under the wire) and the tape.
 */
export function SenseiMeter({ reading, secsLeft, urgent }: { reading: SenseiReading; secsLeft: number; urgent: boolean }) {
  const { name, color } = useTheme();
  const t = senseiTokens(name);
  const { latestRaw, drift, points, nearest } = reading;
  const asset = nearest?.asset ?? "";
  const direction = drift?.direction ?? "flat";
  const dirInk = direction === "up" ? color.profit : direction === "down" ? color.loss : color.inkMuted;
  const move =
    drift && drift.direction !== "flat"
      ? `${drift.moveRaw > 0n ? "+" : "−"}${assetPriceLine(asset, drift.moveRaw < 0n ? -drift.moveRaw : drift.moveRaw, latestRaw ?? undefined)}`
      : SENSEI_UI.flat;
  return (
    <View style={[styles.meter, { borderBottomColor: t.rule }]}>
      <View style={styles.read}>
        <Text style={[styles.spot, { color: t.spot }]}>{latestRaw === null ? SENSEI_UI.reading : assetPriceLine(asset, latestRaw)}</Text>
        {drift ? (
          <>
            <View
              style={
                direction === "flat"
                  ? [styles.flatTri, { backgroundColor: color.inkDisabled }]
                  : [styles.tri, direction === "up" ? { borderBottomWidth: 5, borderBottomColor: dirInk } : { borderTopWidth: 5, borderTopColor: dirInk }]
              }
            />
            <Text style={[styles.drift, { color: dirInk }]}>{move}</Text>
            <Text style={[styles.small, { color: color.inkDisabled }]}>{SENSEI_UI.minute(drift.spanMin)}</Text>
          </>
        ) : null}
        <View style={styles.spacer} />
        {nearest ? (
          <View style={styles.time}>
            <Text style={[styles.timeNum, { color: urgent ? color.accent : t.timeNum }]}>{formatClock(secsLeft)}</Text>
            <Text style={[styles.small, { color: color.inkDisabled }]}>{SENSEI_UI.left}</Text>
          </View>
        ) : null}
      </View>
      <Spark points={points} openingRaw={nearest?.openingPriceRaw ?? null} />
    </View>
  );
}

const styles = StyleSheet.create({
  meter: { paddingTop: 9, paddingBottom: 8, paddingHorizontal: 20, gap: 7, borderBottomWidth: 1 },
  read: { flexDirection: "row", alignItems: "baseline", gap: 7 },
  spot: { fontFamily: FONT.dataStrong, fontSize: 15, lineHeight: 15, letterSpacing: -0.15, fontVariant: ["tabular-nums"] },
  tri: { alignSelf: "center", width: 0, height: 0, borderLeftWidth: 3, borderRightWidth: 3, borderLeftColor: "transparent", borderRightColor: "transparent" },
  flatTri: { alignSelf: "center", width: 6, height: 1.5 },
  drift: { fontFamily: FONT.dataStrong, fontSize: 12.5, lineHeight: 12.5, fontVariant: ["tabular-nums"] },
  small: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 10 },
  spacer: { flex: 1 },
  time: { flexDirection: "row", alignItems: "baseline", gap: 4, paddingBottom: 4 },
  timeNum: { fontFamily: FONT.dataStrong, fontSize: 13, lineHeight: 13, fontVariant: ["tabular-nums"] },
  spark: { height: SPARK_H, borderRadius: 3, overflow: "hidden", marginBottom: 38 },
  band: { position: "absolute", left: 0, right: 0, top: PAD, height: BAND_H },
  strike: { position: "absolute", left: 0, right: 0 },
  tick: { position: "absolute", right: 6, paddingVertical: 1, paddingHorizontal: 4, borderRadius: 2 },
  tickText: { fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 12.8, letterSpacing: 0.48 },
});
