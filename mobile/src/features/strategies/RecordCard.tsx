import { StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { money } from "@/features/strategies/format";
import type { StrategyWire } from "@/features/strategies/protocol";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { EquityChart } from "./EquityChart";

const R = STRATEGIES.desk.record;

/**
 * web's features/strategies/RecordCard.tsx: the track record as a curve over exactly three numbers. Nothing renders
 * until a trade has settled — an empty placeholder is noise. On the detail screen the curve can be scrubbed.
 */
export function RecordCard({ record, decimals, symbol, interactive = false }: {
  record: StrategyWire["record"];
  decimals: number;
  symbol: string;
  interactive?: boolean;
}) {
  const { color } = useTheme();
  if (record.settled === 0) return null;
  const decided = record.wins + record.losses;
  const winRate = decided > 0 ? Math.round((100 * record.wins) / decided) : 0;
  const net = BigInt(record.netBase);
  const netText = `${net >= 0n ? "+" : "−"}${money(net < 0n ? -net : net, decimals)}`;
  return (
    <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={styles.head}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{R.title}</Text>
        <Text style={[TYPE.labelMicro, { color: color.inkDisabled }]}>{R.meta(record.settled)}</Text>
      </View>
      <View style={styles.rate}>
        <Text style={[TYPE.dataHero, { color: color.ink }]}>{winRate}%</Text>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{R.winRate}</Text>
      </View>
      <EquityChart curve={record.curve} decimals={decimals} symbol={symbol} height={interactive ? 120 : 72} interactive={interactive} />
      <View style={[styles.trio, { borderTopColor: color.hairline }]}>
        <Stat label={R.won} value={String(record.wins)} />
        <Stat label={R.lost} value={String(record.losses)} />
        <Stat label={R.net} symbol={symbol} value={netText} tone={net >= 0n ? "up" : "down"} />
      </View>
    </View>
  );
}

/** One cell of the trio. A loss reads in muted ink — a fact, not a scare (web's RecordStat). */
function Stat({ label, value, tone, symbol }: { label: string; value: string; tone?: "up" | "down"; symbol?: string }) {
  const { color } = useTheme();
  const ink = tone === "up" ? color.accent : tone === "down" ? color.inkSecondary : color.ink;
  return (
    <View style={styles.stat}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]} numberOfLines={2}>
        {label}
        {symbol ? <Text style={styles.keepCase}> · {symbol}</Text> : null}
      </Text>
      <Text style={[TYPE.dataLg, { color: ink }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  head: { flexDirection: "row", justifyContent: "space-between", gap: 8 },
  rate: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  trio: { flexDirection: "row", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12 },
  stat: { flex: 1, gap: 6 },
  keepCase: { textTransform: "none" },
});
