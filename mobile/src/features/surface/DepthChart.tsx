import { cumulativeDepth, depthBounds, type DepthStep } from "@agari/core/surface";
import type { BookDepth } from "@agari/core/types";
import { bpsToOddsCents } from "@agari/core/units";
import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { SURFACE } from "@/features/surface/copy";
import { contractsText } from "@/features/surface/format";
import { useTheme } from "~/theme";
import { surfaceTokens } from "~/theme/web/explore/surface";
import { BoxEmpty, MONO, Param, ParamB, Params, SurfaceBox } from "./parts";

const GRID_ROWS = 3;

interface Scale {
  x: (bps: number) => number;
  y: (raw: bigint) => number;
  h: number;
}

/** web's `stepArea`: a step area from the top of the book outward — bids walk left, asks walk right. */
function stepArea(steps: readonly DepthStep[], edgeBps: number, { x, y, h }: Scale): string {
  if (steps.length === 0) return "";
  const parts = [`M${x(steps[0]!.priceBps).toFixed(1)},${h}`];
  let level = 0n;
  for (const step of steps) {
    parts.push(`L${x(step.priceBps).toFixed(1)},${y(level).toFixed(1)}`);
    level = step.cumulativeRaw;
    parts.push(`L${x(step.priceBps).toFixed(1)},${y(level).toFixed(1)}`);
  }
  parts.push(`L${x(edgeBps).toFixed(1)},${y(level).toFixed(1)}`, `L${x(edgeBps).toFixed(1)},${h}`, "Z");
  return parts.join(" ");
}

/**
 * web's DepthChart (§02) in its 220 px `.sf-box--chart.sf-term`: the 44 px column of contract labels, three bands of
 * grid, the bids in ink and the asks in vermilion as step areas, the dashed mid marker, prices under the plot, and
 * both sides' figures in the mono line beneath the box.
 */
export function DepthChart({ depth, hydrating }: { depth: BookDepth | null; hydrating: boolean }) {
  const { name, color } = useTheme();
  const t = surfaceTokens(name);
  const [plot, setPlot] = useState({ w: 0, h: 0 });
  const copy = SURFACE.depth;
  const bids = depth ? cumulativeDepth(depth.upBids) : [];
  const asks = depth ? cumulativeDepth(depth.upAsks) : [];
  const bounds = depthBounds(bids, asks);

  if (!depth || !bounds) {
    return (
      <SurfaceBox style={styles.chart}>
        <BoxEmpty text={hydrating || !depth ? copy.hydrating : copy.empty} />
      </SurfaceBox>
    );
  }

  const { w, h } = plot;
  const span = Math.max(1, bounds.maxBps - bounds.minBps);
  const tall = bounds.maxCumulativeRaw;
  const scale: Scale = {
    x: (bps) => ((bps - bounds.minBps) / span) * w,
    y: (raw) => (tall === 0n ? h : h - (Number((raw * 1000n) / tall) / 1000) * h),
    h,
  };
  const bestBid = bids[0] ?? null;
  const bestAsk = asks[0] ?? null;
  const crossed = bestBid !== null && bestAsk !== null && bestBid.priceBps >= bestAsk.priceBps;
  const midBps = bestBid && bestAsk && !crossed ? (bestBid.priceBps + bestAsk.priceBps) / 2 : null;
  const totalBids = bids.at(-1)?.cumulativeRaw ?? 0n;
  const totalAsks = asks.at(-1)?.cumulativeRaw ?? 0n;
  const gridRows = Array.from({ length: GRID_ROWS + 1 }, (_, i) => (tall * BigInt(GRID_ROWS - i)) / BigInt(GRID_ROWS));
  const xLabels = [bounds.minBps, (bounds.minBps + bounds.maxBps) / 2, bounds.maxBps];
  const onLayout = (e: LayoutChangeEvent) => setPlot({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height });
  const label = `${copy.bids} ${contractsText(totalBids, depth.decimals)}, ${copy.asks} ${contractsText(totalAsks, depth.decimals)}`;
  const axis = [styles.axis, { color: color.inkMuted }];

  return (
    <>
      <SurfaceBox style={[styles.chart, styles.term]}>
        <View style={styles.top} accessible accessibilityRole="image" accessibilityLabel={label}>
          <View style={styles.y}>
            {gridRows.map((raw, i) => (
              <Text key={i} style={axis}>
                {contractsText(raw, depth.decimals)}
              </Text>
            ))}
          </View>
          <View style={styles.plot} onLayout={onLayout}>
            {w > 0 ? (
              <Svg width={w} height={h} style={StyleSheet.absoluteFill}>
                {gridRows.map((raw, i) => (
                  <Line key={i} x1={0} x2={w} y1={scale.y(raw)} y2={scale.y(raw)} stroke={t.grid} strokeWidth={1} />
                ))}
                <Path d={stepArea(bids, bounds.minBps, scale)} fill={t.bidFill} stroke={t.bidStroke} strokeWidth={1} />
                <Path d={stepArea(asks, bounds.maxBps, scale)} fill={t.askFill} stroke={color.accent} strokeWidth={1} />
                {midBps !== null ? <Line x1={scale.x(midBps)} x2={scale.x(midBps)} y1={0} y2={h} stroke={t.midDash} strokeWidth={1} strokeDasharray="3,3" /> : null}
              </Svg>
            ) : null}
            {midBps !== null && w > 0 ? (
              <Text style={[styles.midLabel, { left: scale.x(midBps) + 6, color: color.inkMuted }]}>{copy.mid(`${bpsToOddsCents(midBps)}¢`)}</Text>
            ) : null}
            {crossed ? <Text style={[styles.crossed, { color: color.accent }]}>{copy.crossed}</Text> : null}
          </View>
        </View>
        <View style={styles.x}>
          {w > 0
            ? xLabels.map((bps, i) => (
                <Text key={i} style={[axis, styles.xLabel, i === 0 ? { left: 0 } : i === 1 ? { left: scale.x(bps) - 20, width: 40, textAlign: "center" } : { right: 0 }]}>
                  {bpsToOddsCents(bps)}¢
                </Text>
              ))
            : null}
        </View>
      </SurfaceBox>
      <Params>
        <Param>
          {copy.bids} <ParamB>{bestBid ? `${bpsToOddsCents(bestBid.priceBps)}¢` : "—"}</ParamB> · {copy.contracts(contractsText(totalBids, depth.decimals))}
        </Param>
        <Param>
          {copy.asks} <ParamB>{bestAsk ? `${bpsToOddsCents(bestAsk.priceBps)}¢` : "—"}</ParamB> · {copy.contracts(contractsText(totalAsks, depth.decimals))}
        </Param>
      </Params>
    </>
  );
}

const styles = StyleSheet.create({
  chart: { height: 220, padding: 12 },
  term: { gap: 6 },
  top: { flex: 1, flexDirection: "row", gap: 8 },
  y: { width: 44, alignItems: "flex-end", justifyContent: "space-between" },
  axis: { fontFamily: MONO, fontSize: 9, lineHeight: 14.4, fontVariant: ["tabular-nums"] },
  plot: { flex: 1, minHeight: 0 },
  midLabel: { position: "absolute", top: 0, fontFamily: MONO, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.08, textTransform: "uppercase" },
  crossed: { position: "absolute", top: 0, alignSelf: "center", fontFamily: MONO, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.08, textTransform: "uppercase" },
  x: { marginLeft: 52, height: 12 },
  xLabel: { position: "absolute", top: 0 },
});
