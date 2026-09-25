import { termBand, type TermPoint } from "@agari/core/surface";
import type { MarketId } from "@agari/core/types";
import { bpsToOddsCents, formatClock } from "@agari/core/units";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";
import { SURFACE } from "@/features/surface/copy";
import { FONT, useTheme } from "~/theme";
import { surfaceTokens } from "~/theme/web/explore/surface";
import { BoxEmpty, MONO, SurfaceBox } from "./parts";

const GRID_ROWS = 3;

/**
 * web's TermChart (§04's curve) in its 200 px `.sf-box--short`: each live Window's UP price on a categorical axis
 * ordered by close, the vermilion line, a pressable dot per priced Window (the focal one ringed and scaled 1.4), a dash
 * where a book has nothing, and the cadence and clock under each slot.
 */
export function TermChart({ points, focalId, onPick }: { points: readonly TermPoint[]; focalId: MarketId | null; onPick: (marketId: MarketId) => void }) {
  const { name, color } = useTheme();
  const t = surfaceTokens(name);
  const [plot, setPlot] = useState({ w: 0, h: 0 });
  const copy = SURFACE.term;
  const band = termBand(points);
  const priced = points.filter((p) => p.implied !== null);

  if (points.length < 2 || !band) {
    const empty = points.length < 2 ? copy.oneWindow : priced.length === 0 && points.some((p) => p.structure === null) ? copy.reading : copy.unpriced;
    return (
      <SurfaceBox style={styles.box}>
        <BoxEmpty text={empty} />
      </SurfaceBox>
    );
  }

  const { w, h } = plot;
  const slotX = (i: number) => ((i + 0.5) / points.length) * w;
  const yOf = (bps: number) => (1 - (bps - band.minBps) / Math.max(1, band.maxBps - band.minBps)) * h;
  const line = points
    .map((p, i) => (p.implied ? `${slotX(i).toFixed(1)},${yOf(p.implied.bps).toFixed(1)}` : null))
    .filter((v): v is string => v !== null)
    .join(" ");
  const gridLabels = Array.from({ length: GRID_ROWS + 1 }, (_, i) => band.maxBps - (i / GRID_ROWS) * (band.maxBps - band.minBps));
  const onLayout = (e: LayoutChangeEvent) => setPlot({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });

  return (
    <SurfaceBox style={[styles.box, styles.term]}>
      <View style={styles.top}>
        <View style={styles.y}>
          {gridLabels.map((bps) => (
            <Text key={bps} style={[styles.axis, { color: color.inkMuted }]}>
              {bpsToOddsCents(bps)}¢
            </Text>
          ))}
        </View>
        <View style={styles.plot} onLayout={onLayout}>
          {w > 0 ? (
            <>
              <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
                {gridLabels.map((bps) => (
                  <Line key={bps} x1={0} x2={w} y1={yOf(bps)} y2={yOf(bps)} stroke={t.grid} strokeWidth={1} />
                ))}
                {priced.length >= 2 ? <Polyline points={line} fill="none" stroke={color.accent} strokeWidth={1.8} strokeLinejoin="round" /> : null}
              </Svg>
              {points.map((p, i) => {
                const focal = p.marketId === focalId;
                if (!p.implied) {
                  return (
                    <Text key={p.marketId} style={[styles.gap, { left: slotX(i) - 10, color: color.inkDisabled }]}>
                      {p.structure === null ? "…" : "—"}
                    </Text>
                  );
                }
                const size = focal ? 22.4 : 10;
                return (
                  <Pressable
                    key={p.marketId}
                    onPress={() => onPick(p.marketId)}
                    hitSlop={14}
                    accessibilityRole="button"
                    accessibilityLabel={copy.pick(p.cadence)}
                    accessibilityState={{ selected: focal }}
                    style={[styles.dotWrap, { left: slotX(i) - size / 2, top: yOf(p.implied.bps) - size / 2, width: size, height: size, borderRadius: size / 2 }, focal ? { backgroundColor: t.dotRing } : null]}
                  >
                    <View style={[focal ? styles.dotFocal : styles.dot, { backgroundColor: color.accent, borderColor: t.boxFill }]} />
                  </Pressable>
                );
              })}
            </>
          ) : null}
        </View>
      </View>
      <View style={styles.x}>
        {points.map((p) => {
          const focal = p.marketId === focalId;
          return (
            <View key={p.marketId} style={styles.slot}>
              <Text style={[styles.cadence, { color: focal ? color.accent : color.inkSecondary }]}>{p.cadence}</Text>
              <Text style={[styles.axis, { color: color.inkMuted }]}>{p.remainingSec > 0 ? formatClock(p.remainingSec) : "—"}</Text>
            </View>
          );
        })}
      </View>
    </SurfaceBox>
  );
}

const styles = StyleSheet.create({
  box: { height: 200, padding: 12 },
  term: { gap: 6 },
  top: { flex: 1, flexDirection: "row", gap: 8 },
  y: { width: 44, alignItems: "flex-end", justifyContent: "space-between" },
  axis: { fontFamily: MONO, fontSize: 9, lineHeight: 14.4, fontVariant: ["tabular-nums"] },
  plot: { flex: 1, minHeight: 0 },
  gap: { position: "absolute", bottom: 4, width: 20, textAlign: "center", fontFamily: MONO, fontSize: 10, lineHeight: 16 },
  dotWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  dotFocal: { width: 14, height: 14, borderRadius: 7, borderWidth: 2.8 },
  x: { marginLeft: 52, flexDirection: "row" },
  slot: { flex: 1, minWidth: 0, alignItems: "center", gap: 2 },
  cadence: { fontFamily: FONT.dataStrong, fontSize: 10, lineHeight: 16 },
});
