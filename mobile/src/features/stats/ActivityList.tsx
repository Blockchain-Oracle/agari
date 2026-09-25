import { formatBaseUnits, shortHex } from "@agari/core/units";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ago, STATS } from "@/features/stats/copy";
import type { TractionEvent } from "@/features/stats/protocol";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT, useTheme } from "~/theme";
import { exploreTokens } from "~/theme/web/explore";
import { statsTokens } from "~/theme/web/explore/stats";

interface Props {
  events: readonly TractionEvent[];
  decimals: number;
  symbol: string;
  nowMs: number;
}

/**
 * web's `ActivityList` (features/stats/StatsSections.tsx, stats.css .stats-activity): dot, kind · side · asset, the
 * wallet, the stake, the age and ↗ in one wrapping mono row; the row opens its transaction on Solana Explorer and the
 * wallet opens its account. `/stats` and the leaderboard's Live activity both draw it.
 */
export function ActivityList({ events, decimals, symbol, nowMs }: Props) {
  return (
    <ActivityCard>
      {events.length === 0 ? <ActivityNote text={STATS.activity.empty} /> : null}
      {events.map((event, i) => (
        <Row key={event.id} event={event} decimals={decimals} symbol={symbol} nowMs={nowMs} first={i === 0} />
      ))}
    </ActivityCard>
  );
}

/** The `.stats-activity` card on its own — the leaderboard shows its reading/unreachable line inside it. */
export function ActivityCard({ children }: { children: ReactNode }) {
  const { name } = useTheme();
  const t = statsTokens(name);
  return <View style={[styles.card, { backgroundColor: t.card, borderColor: t.hairline }]}>{children}</View>;
}

/** `.stats-activity-empty`. */
export function ActivityNote({ text }: { text: string }) {
  const { color } = useTheme();
  return (
    <Text style={[styles.empty, { color: color.inkMuted }]} accessibilityRole="text" accessibilityLiveRegion="polite">
      {text}
    </Text>
  );
}

function Row({ event, decimals, symbol, nowMs, first }: { event: TractionEvent; decimals: number; symbol: string; nowMs: number; first: boolean }) {
  const { name, color } = useTheme();
  const t = statsTokens(name);
  const gray300 = exploreTokens(name).gray300;
  const accent = color.accent;
  const call = event.kind === "call";
  const kind = `${STATS.activity.kind[event.kind]} · ${event.side.toUpperCase()} · ${event.asset}`;
  const wallet = shortHex(event.wallet, 6, 4);
  return (
    <Pressable
      onPress={() => void openExternal(explorerUrl("tx", event.txHash))}
      accessibilityRole="link"
      accessibilityLabel={`${kind}, ${wallet}, ${ago(event.atMs, nowMs)}. Open on Solana Explorer`}
      style={({ pressed }) => [styles.row, !first && { borderTopWidth: 1, borderTopColor: t.divider }, pressed && { backgroundColor: t.rowPressed }]}
    >
      <View style={[styles.dot, { backgroundColor: call ? accent : color.inkMuted, shadowColor: call ? accent : color.inkMuted }]} />
      <Text style={[styles.mono12, { color: gray300 }]}>{kind}</Text>
      <Pressable onPress={() => void openExternal(explorerUrl("address", event.wallet))} hitSlop={6} accessibilityRole="link" accessibilityLabel={`Wallet ${wallet} on Solana Explorer`}>
        <Text style={[styles.mono12, { color: color.inkMuted }]}>{wallet}</Text>
      </Pressable>
      <View style={styles.spacer} />
      {event.stakeBase > 0n ? (
        <Text style={[styles.mono12, styles.tabular, { color: gray300 }]}>
          {formatBaseUnits(event.stakeBase, decimals)} {symbol}
        </Text>
      ) : null}
      <Text style={[styles.time, { color: color.inkDisabled }]}>{ago(event.atMs, nowMs)}</Text>
      <Text style={[styles.arrow, { color: accent }]}>↗</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, overflow: "hidden" },
  empty: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2, paddingVertical: 32, paddingHorizontal: 20, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 12, paddingVertical: 12, paddingHorizontal: 20 },
  dot: { width: 6, height: 6, borderRadius: 3, shadowOpacity: 1, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } },
  mono12: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  tabular: { fontVariant: ["tabular-nums"] },
  spacer: { flexGrow: 1, flexBasis: 0 },
  time: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, width: 64, textAlign: "right" },
  arrow: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, width: 16, textAlign: "right" },
});
