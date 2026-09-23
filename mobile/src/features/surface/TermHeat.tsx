import type { TermPoint } from "@agari/core/surface";
import type { MarketId } from "@agari/core/types";
import { bpsToOddsCents } from "@agari/core/units";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SURFACE } from "@/features/surface/copy";
import { centsText, contractsText } from "@/features/surface/format";
import { haptic } from "~/components/kit";
import { FONT, RADIUS, useTheme } from "~/theme";
import { clockText, oraclePriceText } from "./parts";

const EVEN_BPS = 5_000;
/** Four quantized steps of lean, as the calendar heatmap buckets its values. */
const LEAN_OPACITY = [0.06, 0.16, 0.28, 0.42] as const;

const price = (bps: number | null) => (bps === null ? "—" : `${bpsToOddsCents(bps)}¢`);

/** How far the book leans from even money, 0 (even) to 3 (near certain), bucketed. */
function leanStep(bps: number): number {
  const lean = Math.abs(bps - EVEN_BPS) / EVEN_BPS;
  return Math.min(3, Math.floor(lean * 4));
}

function Cell({ point, decimals, nowMs, focal, onPick }: { point: TermPoint; decimals: number; nowMs: number; focal: boolean; onPick: (marketId: MarketId) => void }) {
  const { color } = useTheme();
  const copy = SURFACE.term;
  const s = point.structure;
  const implied = point.implied;
  const heat = implied ? (implied.bps >= EVEN_BPS ? color.profit : color.loss) : null;
  const state = point.unavailable ? copy.unavailable : point.stale ? "stale" : s && s.levels === 0 ? SURFACE.tiles.empty : "";
  const spread = !s ? "…" : s.crossed ? copy.crossed : s.spreadBps === null ? "—" : centsText(s.spreadBps);
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPick(point.marketId);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: focal }}
      accessibilityLabel={`${point.cadence} ${point.asset}, closes in ${clockText(point.expirySec, nowMs)}. UP ${s ? price(s.upAskBps) : "reading"}, DOWN ${s ? price(s.downAskBps) : "reading"}, spread ${spread}. ${state}`}
      style={({ pressed }) => [
        styles.cell,
        { backgroundColor: color.surface1, borderColor: focal ? color.accent : color.hairline },
        focal && styles.focal,
        pressed && styles.pressed,
      ]}
    >
      {heat && implied ? <View style={[StyleSheet.absoluteFill, { backgroundColor: heat, opacity: LEAN_OPACITY[leanStep(implied.bps)] }]} /> : null}
      <View style={styles.head}>
        <Text style={[styles.cadence, { color: focal ? color.accent : color.ink }]}>{point.cadence}</Text>
        <Text style={[styles.small, { color: color.inkMuted }]}>{clockText(point.expirySec, nowMs)}</Text>
      </View>
      <Text style={[styles.big, { color: color.ink }]}>{implied ? `${bpsToOddsCents(implied.bps)}¢` : s === null ? "…" : "—"}</Text>
      <Text style={[styles.small, { color: color.inkSecondary }]}>
        {implied ? copy.basis[implied.basis] : copy.columns.up} · {copy.columns.print} {oraclePriceText(point.openingPriceRaw, point.asset)}
      </Text>
      <View style={styles.facts}>
        <Text style={[styles.small, { color: color.profit }]}>{copy.columns.up} {s ? price(s.upAskBps) : "…"}</Text>
        <Text style={[styles.small, { color: color.loss }]}>{copy.columns.down} {s ? price(s.downAskBps) : "…"}</Text>
        <Text style={[styles.small, { color: color.inkSecondary }]}>± {spread}</Text>
      </View>
      <Text style={[styles.small, { color: color.inkMuted }]}>
        {copy.columns.depth} {s ? `${contractsText(s.upBidDepthRaw, decimals)} / ${contractsText(s.upAskDepthRaw, decimals)}` : "…"}
      </Text>
      {state ? <Text style={[styles.small, { color: color.warning }]}>{state}</Text> : null}
    </Pressable>
  );
}

// 21st: arihantcodes_1f7b8c4d/calendar-heatmap — cells washed by a quantized intensity, the value read on the cell itself.
/**
 * web's term-structure table (features/surface/TermStructure.tsx), as a touch grid: one cell per live Window of the
 * asset, washed green where UP leads and red where DOWN does, deeper the further the book leans from even. Each cell
 * carries the table's columns — clock, opening print, both sides' prices, spread and depth — and picks that Window.
 */
export function TermHeat({ points, decimals, nowMs, focalId, onPick }: {
  points: readonly TermPoint[];
  decimals: number;
  nowMs: number;
  focalId: MarketId | null;
  onPick: (marketId: MarketId) => void;
}) {
  return (
    <View style={styles.grid}>
      {points.map((point) => (
        <Cell key={point.marketId} point={point} decimals={decimals} nowMs={nowMs} focal={point.marketId === focalId} onPick={onPick} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cell: { flexBasis: "47%", flexGrow: 1, minHeight: 44, borderRadius: RADIUS.md, borderWidth: 1, padding: 10, gap: 3, overflow: "hidden" },
  focal: { borderWidth: 2 },
  pressed: { opacity: 0.85 },
  head: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  cadence: { fontFamily: FONT.dataStrong, fontSize: 13 },
  big: { fontFamily: FONT.dataStrong, fontSize: 22, lineHeight: 26 },
  small: { fontFamily: FONT.data, fontSize: 10.5 },
  facts: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
});
