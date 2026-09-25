import { StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { money } from "@/features/strategies/format";
import type { StrategyWire } from "@/features/strategies/protocol";
import { FONT } from "~/theme";
import { curvePoints, EquitySparkline } from "./EquitySparkline";
import { ST, useStrat } from "./ui";

const R = STRATEGIES.desk.record;

/** One cell of the trio (web DeskInputs `RecordStat`): a loss reads in muted ink — a fact, not a scare. */
function RecordStat({ label, symbol, value, accent, first }: { label: string; symbol?: string; value: string; accent?: "up" | "down"; first?: boolean }) {
  const { t, color } = useStrat();
  const tone = accent === "up" ? color.accent : accent === "down" ? t.ink(0.8) : color.ink;
  return (
    <View style={[styles.cell, !first && { borderLeftWidth: 1, borderLeftColor: t.ink(0.07) }]}>
      <Text style={[ST.deskEyebrow, styles.cellLabel, { color: t.ink(0.4) }]}>
        {label}
        {symbol ? <Text style={styles.keepCase}>{symbol}</Text> : null}
      </Text>
      <Text style={[styles.trioValue, { color: tone }]}>{value}</Text>
    </View>
  );
}

/**
 * web's features/strategies/RecordCard.tsx (desk.css `.desk-record`): the win rate over the cumulative curve and the
 * won / lost / net trio. Nothing renders until a trade has settled.
 */
export function RecordCard({ record, decimals, symbol }: { record: StrategyWire["record"]; decimals: number; symbol: string }) {
  const { t, color } = useStrat();
  if (record.settled === 0) return null;
  const decided = record.wins + record.losses;
  const winRate = decided > 0 ? Math.round((100 * record.wins) / decided) : 0;
  const net = BigInt(record.netBase);
  const netUp = net >= 0n;
  const netStr = `${netUp ? "+" : "−"}${money(net < 0n ? -net : net, decimals)}`;
  return (
    <View style={[styles.card, { borderColor: t.ink(0.08), backgroundColor: t.ink(0.015) }]}>
      <View style={styles.head}>
        <Text style={[ST.deskEyebrow, { color: t.ink(0.4) }]}>{R.title}</Text>
        <Text style={[ST.deskFine, styles.meta, { color: t.ink(0.3) }]}>{R.meta(record.settled)}</Text>
      </View>
      <View style={styles.rate}>
        <Text style={[styles.winrate, { color: color.ink }]}>{winRate}%</Text>
        <Text style={[ST.deskNote, styles.meta, { color: t.ink(0.45) }]}>{R.winRate}</Text>
      </View>
      <View style={styles.spark}>
        <EquitySparkline points={curvePoints(record.curve)} decimals={decimals} />
      </View>
      <View style={[styles.trio, { borderTopColor: t.ink(0.07) }]}>
        <RecordStat first label={R.won} value={String(record.wins)} />
        <RecordStat label={R.lost} value={String(record.losses)} />
        <RecordStat label={`${R.net} · `} symbol={symbol} value={netStr} accent={netUp ? "up" : "down"} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingTop: 12 },
  meta: { textTransform: "uppercase", letterSpacing: 1.44 },
  rate: { flexDirection: "row", alignItems: "baseline", gap: 10, paddingHorizontal: 16, paddingTop: 10 },
  winrate: { fontFamily: FONT.headingHeavy, fontSize: 34, lineHeight: 34, fontVariant: ["tabular-nums"] },
  spark: { paddingHorizontal: 16, paddingVertical: 8 },
  trio: { flexDirection: "row", borderTopWidth: 1 },
  cell: { flex: 1, minWidth: 0, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center" },
  cellLabel: { marginBottom: 6, textAlign: "center" },
  keepCase: { textTransform: "none" },
  trioValue: { fontFamily: FONT.headingHeavy, fontSize: 21, lineHeight: 21, fontVariant: ["tabular-nums"], textAlign: "center" },
});
