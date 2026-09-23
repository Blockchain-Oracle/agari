import { cumulativeDepth, depthBounds, type DepthStep } from "@agari/core/surface";
import type { BookDepth } from "@agari/core/types";
import { bpsToOddsCents } from "@agari/core/units";
import { useState } from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { SURFACE } from "@/features/surface/copy";
import { contractsText } from "@/features/surface/format";
import { FONT, useTheme } from "~/theme";
import { Params, SurfaceBox } from "./parts";

const H = 150;
const Y_COL = 44;
const GRID_ROWS = 3;

interface Scale {
  x: (bps: number) => number;
  y: (raw: bigint) => number;
}

/** A step area from the top of the book outward: bids walk left toward `edgeBps`, asks walk right. */
function stepArea(steps: readonly DepthStep[], edgeBps: number, { x, y }: Scale): string {
  const first = steps[0];
  if (!first) return "";
  const parts = [`M${x(first.priceBps).toFixed(1)},${H}`];
  let level = 0n;
  for (const step of steps) {
    parts.push(`L${x(step.priceBps).toFixed(1)},${y(level).toFixed(1)}`);
    level = step.cumulativeRaw;
    parts.push(`L${x(step.priceBps).toFixed(1)},${y(level).toFixed(1)}`);
  }
  parts.push(`L${x(edgeBps).toFixed(1)},${y(level).toFixed(1)}`, `L${x(edgeBps).toFixed(1)},${H}`, "Z");
  return parts.join(" ");
}

/**
 * web's `DepthChart` (features/surface/DepthChart.tsx): cumulative resting size at each price on the UP book — bids
 * stepping left, asks stepping right — with contracts up the side, prices along the bottom, the dashed mid, and the
 * two sides' best price and total size in the mono line beneath.
 */
export function DepthChart({ depth, hydrating }: { depth: BookDepth | null; hydrating: boolean }) {
  const { color } = useTheme();
  const [width, setWidth] = useState(0);
  const copy = SURFACE.depth;
  const bids = depth ? cumulativeDepth(depth.upBids) : [];
  const asks = depth ? cumulativeDepth(depth.upAsks) : [];
  const bounds = depthBounds(bids, asks);
  if (!depth || !bounds) return <SurfaceBox empty={hydrating || !depth ? copy.hydrating : copy.empty} />;

  const W = Math.max(1, width - Y_COL);
  const span = Math.max(1, bounds.maxBps - bounds.minBps);
  const tall = bounds.maxCumulativeRaw;
  const scale: Scale = {
    x: (bps) => ((bps - bounds.minBps) / span) * W,
    y: (raw) => (tall === 0n ? H : H - (Number((raw * 1000n) / tall) / 1000) * (H - 6)),
  };
  const bestBid = bids[0] ?? null;
  const bestAsk = asks[0] ?? null;
  const crossed = bestBid !== null && bestAsk !== null && bestBid.priceBps >= bestAsk.priceBps;
  const midBps = bestBid && bestAsk && !crossed ? (bestBid.priceBps + bestAsk.priceBps) / 2 : null;
  const totalBids = bids.at(-1)?.cumulativeRaw ?? 0n;
  const totalAsks = asks.at(-1)?.cumulativeRaw ?? 0n;
  const gridRows = Array.from({ length: GRID_ROWS + 1 }, (_, i) => (tall * BigInt(GRID_ROWS - i)) / BigInt(GRID_ROWS));
  const xLabels = [bounds.minBps, (bounds.minBps + bounds.maxBps) / 2, bounds.maxBps];
  const label = `${copy.bids} ${contractsText(totalBids, depth.decimals)}, ${copy.asks} ${contractsText(totalAsks, depth.decimals)}`;

  return (
    <>
      <SurfaceBox>
        <View style={styles.plot} onLayout={(e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width))} accessible accessibilityRole="image" accessibilityLabel={label}>
          <View style={styles.yCol}>
            {gridRows.map((raw, i) => (
              <Text key={i} style={[styles.axis, { color: color.inkMuted }]}>
                {contractsText(raw, depth.decimals)}
              </Text>
            ))}
          </View>
          {width > 0 ? (
            <Svg width={W} height={H}>
              {gridRows.map((raw, i) => (
                <Line key={i} x1={0} x2={W} y1={scale.y(raw)} y2={scale.y(raw)} stroke={color.hairline} strokeWidth={1} />
              ))}
              <Path d={stepArea(bids, bounds.minBps, scale)} fill={color.profitWash} stroke={color.profit} strokeWidth={1.5} />
              <Path d={stepArea(asks, bounds.maxBps, scale)} fill={color.lossWash} stroke={color.loss} strokeWidth={1.5} />
              {midBps !== null ? <Line x1={scale.x(midBps)} x2={scale.x(midBps)} y1={0} y2={H} stroke={color.accent} strokeWidth={1} strokeDasharray="4 4" /> : null}
            </Svg>
          ) : null}
        </View>
        <View style={[styles.xRow, { marginLeft: Y_COL }]}>
          {xLabels.map((bps, i) => (
            <Text key={i} style={[styles.axis, { color: color.inkMuted }]}>
              {bpsToOddsCents(bps)}¢
            </Text>
          ))}
        </View>
        {midBps !== null ? <Text style={[styles.axis, styles.mid, { color: color.accent }]}>{copy.mid(`${bpsToOddsCents(midBps)}¢`)}</Text> : null}
        {crossed ? <Text style={[styles.axis, styles.mid, { color: color.warning }]}>{copy.crossed}</Text> : null}
      </SurfaceBox>
      <Params
        items={[
          `${copy.bids} ${bestBid ? `${bpsToOddsCents(bestBid.priceBps)}¢` : "—"} · ${copy.contracts(contractsText(totalBids, depth.decimals))}`,
          `${copy.asks} ${bestAsk ? `${bpsToOddsCents(bestAsk.priceBps)}¢` : "—"} · ${copy.contracts(contractsText(totalAsks, depth.decimals))}`,
        ]}
      />
    </>
  );
}

const styles = StyleSheet.create({
  plot: { flexDirection: "row", height: H },
  yCol: { width: Y_COL, justifyContent: "space-between", paddingRight: 4 },
  axis: { fontFamily: FONT.data, fontSize: 10 },
  xRow: { flexDirection: "row", justifyContent: "space-between" },
  mid: { textAlign: "center" },
});
