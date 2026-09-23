import { termBand, type TermPoint } from "@agari/core/surface";
import type { MarketId } from "@agari/core/types";
import { bpsToOddsCents } from "@agari/core/units";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Line, Polyline } from "react-native-svg";
import { SURFACE } from "@/features/surface/copy";
import { haptic } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { SurfaceBox } from "./parts";

const H = 120;
const Y_COL = 40;
const GRID_ROWS = 3;
const DOT = 28;

/**
 * web's `TermChart` (features/surface/TermChart.tsx): each live Window's UP price (mid where both sides rest) on a
 * categorical axis ordered by close. Every point is a 44-pt touch target that reads that Window in the sections above.
 */
export function TermChart({ points, focalId, onPick }: { points: readonly TermPoint[]; focalId: MarketId | null; onPick: (marketId: MarketId) => void }) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const copy = SURFACE.term;
  const band = termBand(points);
  const priced = points.filter((p) => p.implied !== null);

  if (points.length < 2 || !band) {
    const empty = points.length < 2 ? copy.oneWindow : priced.length === 0 && points.some((p) => p.structure === null) ? copy.reading : copy.unpriced;
    return <SurfaceBox empty={empty} />;
  }

  const W = Math.max(1, width - Y_COL);
  const slotX = (i: number) => ((i + 0.5) / points.length) * W;
  const yOf = (bps: number) => (1 - (bps - band.minBps) / Math.max(1, band.maxBps - band.minBps)) * H;
  const line = points
    .map((p, i) => (p.implied ? `${slotX(i).toFixed(1)},${yOf(p.implied.bps).toFixed(1)}` : null))
    .filter((v): v is string => v !== null)
    .join(" ");
  const gridLabels = Array.from({ length: GRID_ROWS + 1 }, (_, i) => band.maxBps - (i / GRID_ROWS) * (band.maxBps - band.minBps));

  return (
    <SurfaceBox>
      <View style={styles.plot} onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))}>
        <View style={styles.yCol}>
          {gridLabels.map((bps) => (
            <Text key={bps} style={[styles.axis, { color: color.inkMuted }]}>
              {bpsToOddsCents(bps)}¢
            </Text>
          ))}
        </View>
        {width > 0 ? (
          <View style={{ width: W, height: H }}>
            <Svg width={W} height={H}>
              {gridLabels.map((bps) => (
                <Line key={bps} x1={0} x2={W} y1={yOf(bps)} y2={yOf(bps)} stroke={color.hairline} strokeWidth={1} />
              ))}
              {priced.length >= 2 ? <Polyline points={line} fill="none" stroke={color.accent} strokeWidth={2} strokeLinejoin="round" /> : null}
            </Svg>
            {points.map((p, i) => {
              const focal = p.marketId === focalId;
              if (!p.implied) {
                return (
                  <Text key={p.marketId} style={[styles.gap, { left: slotX(i) - 8, color: color.inkMuted }]}>
                    {p.structure === null ? "…" : "—"}
                  </Text>
                );
              }
              const priceText = `${bpsToOddsCents(p.implied.bps)}¢`;
              return (
                <Pressable
                  key={p.marketId}
                  onPress={() => {
                    haptic.select();
                    onPick(p.marketId);
                  }}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityState={{ selected: focal }}
                  accessibilityLabel={`${copy.pick(p.cadence)}: ${copy.point(p.cadence, priceText, copy.basis[p.implied.basis])}`}
                  style={[styles.hit, { left: slotX(i) - DOT / 2, top: yOf(p.implied.bps) - DOT / 2 }]}
                >
                  <View
                    style={[
                      styles.dot,
                      focal
                        ? { width: 14, height: 14, borderRadius: 7, backgroundColor: color.accent, borderColor: color.ink }
                        : { backgroundColor: color.ground, borderColor: color.accent },
                    ]}
                  />
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
      <View style={[styles.xRow, { marginLeft: Y_COL }]}>
        {points.map((p) => (
          <Text key={p.marketId} style={[styles.axis, styles.xLabel, { color: p.marketId === focalId ? color.accent : color.inkMuted }]} numberOfLines={1}>
            {p.cadence}
          </Text>
        ))}
      </View>
    </SurfaceBox>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: "row", height: H },
  yCol: { width: Y_COL, justifyContent: "space-between", paddingRight: 4 },
  axis: { fontFamily: FONT.data, fontSize: 10 },
  xRow: { flexDirection: "row" },
  xLabel: { flex: 1, textAlign: "center" },
  gap: { position: "absolute", top: H / 2 - 8, fontFamily: FONT.data, fontSize: 12, width: 16, textAlign: "center" },
  hit: { position: "absolute", width: DOT, height: DOT, alignItems: "center", justifyContent: "center" },
  dot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
});
