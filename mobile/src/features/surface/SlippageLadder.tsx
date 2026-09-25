import { slippageLadder, stakeLadder, type SlippageRow } from "@agari/core/surface";
import type { BookDepth, Side } from "@agari/core/types";
import { bpsToOddsCents, formatBaseUnits } from "@agari/core/units";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SIDE_WORD, SIDES } from "@/features/markets/side-styles";
import { SURFACE } from "@/features/surface/copy";
import { centsText, contractsText, lotText } from "@/features/surface/format";
import { useTheme } from "~/theme";
import { exploreTokens } from "~/theme/web/explore";
import { surfaceTokens } from "~/theme/web/explore/surface";
import { BoxEmpty, MONO, Param, Params, SurfaceBox } from "./parts";
import { WindowChip } from "./SurfaceChips";

/** `.sf-row`: grid 1.1fr 0.9fr 0.8fr 1fr 1fr 1.3fr, gap 8, min-width 560, padding 0 20 — the box scrolls sideways. */
const ROW_W = 560;
const FR = (ROW_W - 40 - 5 * 8) / 6.1;
const COLS = [1.1, 0.9, 0.8, 1, 1, 1.3].map((f) => f * FR);

function Row({ row, decimals, symbol }: { row: SlippageRow; decimals: number; symbol: string }) {
  const { name, color } = useTheme();
  const t = surfaceTokens(name);
  const gray300 = exploreTokens(name).gray300;
  const copy = SURFACE.ladder;
  const nothing = row.contractsRaw === 0n;
  const beyond = row.exhausted;
  const ink = beyond ? color.inkMuted : gray300;
  const num = (i: number, text: string, tint?: string) => (
    <Text style={[styles.cell, styles.num, { width: COLS[i], color: tint ?? ink }]}>{text}</Text>
  );
  const slip = row.slippageBps === null ? "—" : row.slippageBps === 0 ? "0¢" : `+${centsText(row.slippageBps)}`;
  return (
    <View style={[styles.row, beyond ? { backgroundColor: t.focalWash } : null]}>
      <Text style={[styles.cell, { width: COLS[0], color: beyond ? color.inkSecondary : gray300 }]}>
        {formatBaseUnits(row.stakeBase, decimals, { minDp: 0 })} <Text style={[styles.unit, { color: color.inkMuted }]}>{symbol}</Text>
      </Text>
      {num(1, row.avgPriceBps === null ? "—" : `${bpsToOddsCents(row.avgPriceBps)}¢`)}
      {num(2, slip, row.slippageBps !== null && row.slippageBps > 0 ? color.inkSecondary : undefined)}
      {num(3, nothing ? "—" : contractsText(row.contractsRaw, decimals))}
      {num(4, nothing || row.payoutIfRightBase === null ? "—" : formatBaseUnits(row.payoutIfRightBase, decimals), t.pays)}
      <Text style={[styles.fill, { width: COLS[5], color: beyond ? color.accent : color.inkMuted }]}>{nothing ? copy.nothing : beyond ? copy.beyond : copy.full}</Text>
    </View>
  );
}

/** web's SlippageLadder (§03): the Buy UP / Buy DOWN chips, the stake ladder walked as a taker, the lot and fee line. */
export function SlippageLadder({ depth, hydrating, symbol, lotRaw, feeBps }: { depth: BookDepth | null; hydrating: boolean; symbol: string; lotRaw: bigint | null; feeBps: number | null }) {
  const { name, color } = useTheme();
  const t = surfaceTokens(name);
  const [side, setSide] = useState<Side>("up");
  const copy = SURFACE.ladder;
  const asks = depth ? (side === "up" ? depth.upAsks : depth.downAsks) : [];
  const ready = depth !== null && lotRaw !== null;
  const rows = ready ? slippageLadder(asks, stakeLadder(depth.decimals), depth.decimals, lotRaw, feeBps) : [];
  const head = [copy.stake, copy.avg, copy.vsTop, copy.contracts, copy.pays, copy.fill];

  return (
    <View style={styles.ladder}>
      <View style={styles.sides}>
        {SIDES.map((s) => (
          <WindowChip key={s} on={side === s} onPress={() => setSide(s)} label={copy.side(SIDE_WORD[s])} />
        ))}
      </View>
      <SurfaceBox>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
          <View style={styles.table}>
            <View style={[styles.row, styles.head, { borderBottomColor: t.headRule }]}>
              {head.map((h, i) => (
                <Text key={h} style={[styles.headCell, { width: COLS[i], color: color.inkMuted }, i > 0 && i < 5 ? styles.num : null]}>
                  {h}
                </Text>
              ))}
            </View>
            {!ready || asks.length === 0 ? (
              <View>
                <BoxEmpty rows text={!ready ? (hydrating || depth === null || lotRaw === null ? copy.loading : copy.empty(SIDE_WORD[side])) : copy.empty(SIDE_WORD[side])} />
              </View>
            ) : (
              rows.map((row) => <Row key={row.stakeBase.toString()} row={row} decimals={depth.decimals} symbol={symbol} />)
            )}
          </View>
        </ScrollView>
      </SurfaceBox>
      {ready ? (
        <Params>
          <Param>{copy.lot(lotText(lotRaw, depth.decimals))}</Param>
          {feeBps !== null ? <Param>{copy.fee(feeBps)}</Param> : null}
          <Param>{copy.unguarded}</Param>
        </Params>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ladder: { gap: 12 },
  sides: { flexDirection: "row", gap: 8 },
  scroll: { flexGrow: 1 },
  table: { minWidth: ROW_W, flexGrow: 1 },
  row: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingVertical: 8, paddingHorizontal: 20 },
  head: { paddingVertical: 10, borderBottomWidth: 1 },
  headCell: { fontFamily: MONO, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.44, textTransform: "uppercase" },
  cell: { fontFamily: MONO, fontSize: 12, lineHeight: 19.2, fontVariant: ["tabular-nums"] },
  num: { textAlign: "right" },
  unit: { fontSize: 10, lineHeight: 16 },
  fill: { fontFamily: MONO, fontSize: 10, lineHeight: 16, letterSpacing: 1, textTransform: "uppercase", textAlign: "right" },
});
