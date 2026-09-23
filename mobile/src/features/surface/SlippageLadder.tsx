import { slippageLadder, stakeLadder, type SlippageRow } from "@agari/core/surface";
import type { BookDepth, Side } from "@agari/core/types";
import { bpsToOddsCents, formatBaseUnits } from "@agari/core/units";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SIDE_WORD, SIDES } from "@/features/markets/side-styles";
import { SURFACE } from "@/features/surface/copy";
import { centsText, contractsText, lotText } from "@/features/surface/format";
import { Segmented } from "~/components/kit";
import { FONT, useTheme } from "~/theme";
import { Params, SurfaceBox } from "./parts";

const COLS = [1.3, 1, 0.9, 1.1, 1.2] as const;

function Cells({ values, tones }: { values: readonly string[]; tones?: readonly (string | undefined)[] }) {
  const { color } = useTheme();
  return (
    <>
      {values.map((value, i) => (
        <Text key={i} style={[styles.cell, { flex: COLS[i], color: tones?.[i] ?? color.ink, textAlign: i === 0 ? "left" : "right" }]} numberOfLines={1} adjustsFontSizeToFit>
          {value}
        </Text>
      ))}
    </>
  );
}

function LadderRow({ row, decimals, symbol }: { row: SlippageRow; decimals: number; symbol: string }) {
  const { color } = useTheme();
  const copy = SURFACE.ladder;
  const nothing = row.contractsRaw === 0n;
  const values = [
    `${formatBaseUnits(row.stakeBase, decimals, { minDp: 0 })} ${symbol}`,
    row.avgPriceBps === null ? "—" : `${bpsToOddsCents(row.avgPriceBps)}¢`,
    row.slippageBps === null ? "—" : row.slippageBps === 0 ? "0¢" : `+${centsText(row.slippageBps)}`,
    nothing ? "—" : contractsText(row.contractsRaw, decimals),
    nothing || row.payoutIfRightBase === null ? "—" : formatBaseUnits(row.payoutIfRightBase, decimals),
  ];
  const fill = nothing ? copy.nothing : row.exhausted ? copy.beyond : copy.full;
  return (
    <View
      style={[styles.row, { borderTopColor: color.hairline }, row.exhausted && { backgroundColor: color.accentWash }]}
      accessible
      accessibilityLabel={`${copy.stake} ${values[0]}: ${copy.avg} ${values[1]}, ${copy.vsTop} ${values[2]}, ${copy.contracts} ${values[3]}, ${copy.pays} ${values[4]}. ${fill}`}
    >
      <View style={styles.line}>
        <Cells values={values} tones={[undefined, undefined, row.slippageBps !== null && row.slippageBps > 0 ? color.loss : undefined, undefined, color.profit]} />
      </View>
      <Text style={[styles.fill, { color: row.exhausted ? color.accent : color.inkMuted }]}>{fill}</Text>
    </View>
  );
}

/**
 * web's `SlippageLadder` (features/surface/SlippageLadder.tsx): every stake priced off the visible asks the way the venue
 * fills a taker — average price, slippage over the top, contracts and what they pay if right; the rows the book can
 * no longer fill in full are washed in vermilion.
 */
export function SlippageLadder({ depth, hydrating, symbol, lotRaw, feeBps }: {
  depth: BookDepth | null;
  hydrating: boolean;
  symbol: string;
  lotRaw: bigint | null;
  feeBps: number | null;
}) {
  const { color } = useTheme();
  const [side, setSide] = useState<Side>("up");
  const copy = SURFACE.ladder;
  const asks = depth ? (side === "up" ? depth.upAsks : depth.downAsks) : [];
  const ready = depth !== null && lotRaw !== null;
  const rows = ready ? slippageLadder(asks, stakeLadder(depth.decimals), depth.decimals, lotRaw, feeBps) : [];

  let body;
  if (!ready) body = <SurfaceBox empty={hydrating || depth === null || lotRaw === null ? copy.loading : copy.empty(SIDE_WORD[side])} />;
  else if (asks.length === 0) body = <SurfaceBox empty={copy.empty(SIDE_WORD[side])} />;
  else {
    body = (
      <SurfaceBox>
        <View style={styles.line}>
          <Cells values={[copy.stake, copy.avg, copy.vsTop, copy.contracts, copy.pays]} tones={Array(5).fill(color.inkMuted)} />
        </View>
        {rows.map((row) => (
          <LadderRow key={row.stakeBase.toString()} row={row} decimals={depth.decimals} symbol={symbol} />
        ))}
      </SurfaceBox>
    );
  }

  return (
    <View style={styles.wrap}>
      <Segmented label={copy.side("")} value={side} onChange={setSide} options={SIDES.map((s) => ({ value: s, label: copy.side(SIDE_WORD[s]) }))} />
      {body}
      {ready ? <Params items={[copy.lot(lotText(lotRaw, depth.decimals)), ...(feeBps !== null ? [copy.fee(feeBps)] : []), copy.unguarded]} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  line: { flexDirection: "row", gap: 6 },
  row: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 8, gap: 2 },
  cell: { fontFamily: FONT.data, fontSize: 12 },
  fill: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 0.6, textTransform: "uppercase" },
});
