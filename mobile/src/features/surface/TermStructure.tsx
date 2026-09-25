import type { TermPoint } from "@agari/core/surface";
import type { MarketId } from "@agari/core/types";
import { bpsToOddsCents } from "@agari/core/units";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SURFACE } from "@/features/surface/copy";
import { centsText, contractsText } from "@/features/surface/format";
import { FONT, useTheme } from "~/theme";
import { exploreTokens } from "~/theme/web/explore";
import { surfaceTokens } from "~/theme/web/explore/surface";
import { Countdown, MONO, oraclePriceText, StaleTick, SurfaceBox } from "./parts";
import { TermChart } from "./TermChart";

/** `.sf-trow`: grid 1.2 0.8 1.1 0.6 0.6 0.7 1.2 1 fr, gap 8, min-width 760, padding 0 20 — the box scrolls sideways. */
const ROW_W = 760;
const FR = (ROW_W - 40 - 7 * 8) / 7.2;
const COLS = [1.2, 0.8, 1.1, 0.6, 0.6, 0.7, 1.2, 1].map((f) => f * FR);

const price = (bps: number | null) => (bps === null ? "—" : `${bpsToOddsCents(bps)}¢`);

interface Props {
  points: readonly TermPoint[];
  decimals: number;
  nowMs: number;
  focalId: MarketId | null;
  onPick: (marketId: MarketId) => void;
}

function Row({ point, decimals, nowMs, focal, onPick }: { point: TermPoint; decimals: number; nowMs: number; focal: boolean; onPick: (marketId: MarketId) => void }) {
  const { name, color } = useTheme();
  const t = surfaceTokens(name);
  const ink = exploreTokens(name).gray300;
  const copy = SURFACE.term;
  const s = point.structure;
  const cell = (i: number, text: string, tint?: string) => (
    <Text style={[styles.cell, styles.num, { width: COLS[i], color: tint ?? ink }]}>{text}</Text>
  );
  const spread = !s ? "…" : s.crossed ? null : s.spreadBps === null ? "—" : centsText(s.spreadBps);
  const state = point.unavailable ? copy.unavailable : s && s.levels === 0 ? SURFACE.tiles.empty : "";
  return (
    <Pressable onPress={() => onPick(point.marketId)} accessibilityRole="button" accessibilityState={{ selected: focal }} style={[styles.row, focal ? { backgroundColor: t.focalWash } : null]}>
      <Text style={[styles.cell, { width: COLS[0], color: ink }]}>
        <Text style={[styles.cadence, { color: focal ? color.accent : color.ink }]}>{point.cadence}</Text> {point.asset}
      </Text>
      <Countdown expirySec={point.expirySec} intervalSec={point.intervalSec} nowMs={nowMs} style={[styles.cell, styles.num, { width: COLS[1], color: ink }]} />
      {cell(2, oraclePriceText(point.openingPriceRaw, point.asset))}
      {cell(3, s ? price(s.upAskBps) : "…", t.pays)}
      {cell(4, s ? price(s.downAskBps) : "…")}
      {spread === null ? <Text style={[styles.state, styles.num, { width: COLS[5], color: color.accent }]}>{copy.crossed}</Text> : cell(5, spread)}
      {cell(6, s ? `${contractsText(s.upBidDepthRaw, decimals)} / ${contractsText(s.upAskDepthRaw, decimals)}` : "…")}
      <View style={{ width: COLS[7] }}>
        {point.stale && !point.unavailable ? <StaleTick asOfMs={0} compact /> : <Text style={[styles.state, styles.num, { color: color.inkMuted }]}>{state}</Text>}
      </View>
    </Pressable>
  );
}

/** web's TermStructure (§04): the curve, then the same Windows as rows; any row reads that Window in the sections above. */
export function TermStructure({ points, decimals, nowMs, focalId, onPick }: Props) {
  const { name, color } = useTheme();
  const t = surfaceTokens(name);
  const { columns } = SURFACE.term;
  const head = [columns.window, columns.closes, columns.print, columns.up, columns.down, columns.spread, columns.depth, columns.state];
  return (
    <View style={styles.wrap}>
      <TermChart points={points} focalId={focalId} onPick={onPick} />
      <SurfaceBox>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.table}>
            <View style={[styles.row, styles.head, { borderBottomColor: t.headRule }]}>
              {head.map((h, i) => (
                <Text key={h} style={[styles.headCell, { width: COLS[i], color: color.inkMuted }, i > 0 && i < 7 ? styles.num : null]}>
                  {h}
                </Text>
              ))}
            </View>
            {points.map((point) => (
              <Row key={point.marketId} point={point} decimals={decimals} nowMs={nowMs} focal={point.marketId === focalId} onPick={onPick} />
            ))}
          </View>
        </ScrollView>
      </SurfaceBox>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  scroll: { flexGrow: 1 },
  table: { minWidth: ROW_W, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingVertical: 8, paddingHorizontal: 20 },
  head: { paddingVertical: 10, borderBottomWidth: 1 },
  headCell: { fontFamily: MONO, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.44, textTransform: "uppercase" },
  cell: { fontFamily: MONO, fontSize: 12, lineHeight: 19.2, fontVariant: ["tabular-nums"] },
  cadence: { fontFamily: FONT.dataStrong },
  num: { textAlign: "right" },
  state: { fontFamily: MONO, fontSize: 10, lineHeight: 16, letterSpacing: 1, textTransform: "uppercase" },
});
