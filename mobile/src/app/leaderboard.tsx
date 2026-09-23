import { TICKER_SYMBOLS, type TickerSymbol } from "@agari/core/market";
import { formatBaseUnits } from "@agari/core/units";
import { useQuery } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { leaderboardPayloadSchema, toBoardData, type BoardPeriod } from "@/features/leaderboard/protocol";
import { useWalletSession } from "@/lib/wallet-session";
import { SITE_URL } from "~/lib/env";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/** The same validated board payload as web, fetched by absolute URL on a phone. */
export default function LeaderboardScreen() {
  const { color } = useTheme();
  const { address } = useWalletSession();
  const [period, setPeriod] = useState<BoardPeriod>("session");
  const [ticker, setTicker] = useState<TickerSymbol | null>(null);
  const query = useQuery({
    queryKey: ["mobile", "leaderboard", period, ticker],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ period, ...(ticker ? { ticker } : {}) });
      const response = await fetch(`${SITE_URL}/api/leaderboard?${params}`, { signal });
      if (!response.ok) throw new Error(`Board request failed (${response.status})`);
      return toBoardData(leaderboardPayloadSchema.parse(await response.json()));
    },
    staleTime: 120_000,
    refetchInterval: 120_000,
  });
  const board = query.data;
  const myRank = board?.rankings.findIndex((r) => r.owner === address) ?? -1;
  return <>
    <Stack.Screen options={{ title: "Leaderboard", headerShown: true }} />
    <ScrollView style={{ backgroundColor: color.ground }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
      <Text style={[styles.kicker, { color: color.accent }]}>VERIFIED TRADING RECORDS</Text>
      <Text style={[TYPE.display, { color: color.ink }]}>The house of names.</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>Ranked from settled calls. Changing the period or ticker reads a new board from the index.</Text>
      <View style={styles.filters}>{(["session", "24h"] as const).map((choice) => <Pressable key={choice} onPress={() => setPeriod(choice)} accessibilityRole="tab" accessibilityState={{ selected: period === choice }} style={[styles.chip, { backgroundColor: period === choice ? color.ink : color.surface1, borderColor: color.hairline }]}><Text style={[TYPE.caption, { color: period === choice ? color.ground : color.ink }]}>{choice === "session" ? "This session" : "Last 24 hours"}</Text></Pressable>)}</View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{[null, ...TICKER_SYMBOLS].map((choice) => <Pressable key={choice ?? "all"} onPress={() => setTicker(choice)} accessibilityRole="tab" accessibilityState={{ selected: ticker === choice }} style={[styles.chip, { backgroundColor: ticker === choice ? color.accent : color.surface1, borderColor: color.hairline }]}><Text style={[TYPE.caption, { color: ticker === choice ? color.onAccent : color.ink }]}>{choice ?? "All"}</Text></Pressable>)}</ScrollView>
      {query.isPending ? <Note text="Counting settled calls…" /> : query.isError ? <View style={styles.error}><Note text={query.error.message} /><Action label="Retry board" onPress={() => void query.refetch()} /></View> : board ? <>
        <View style={[styles.meta, { borderColor: color.hairline }]}><Text style={[TYPE.caption, { color: color.inkSecondary }]}>{board.meta.rankedTraders} ranked traders · {board.meta.closedCalls} closed calls</Text><Text style={[TYPE.caption, { color: color.inkMuted }]}>{board.meta.complete ? "Complete scan" : "Partial scan"} · {new Date(board.meta.computedAtMs).toLocaleTimeString()}</Text></View>
        {address ? <Note text={myRank >= 0 ? `Your rank: ${myRank + 1} of ${board.rankings.length}` : "Your connected wallet has no settled rank in this view."} /> : <Note text="Connect a wallet to locate your rank." />}
        {board.rankings.length ? board.rankings.map((row, index) => <View key={row.owner} style={[styles.row, { backgroundColor: row.owner === address ? color.accentWash : color.surface1, borderColor: color.hairline }]}><Text style={[styles.rank, { color: color.accent }]}>{String(index + 1).padStart(2, "0")}</Text><View style={styles.person}><Text style={[TYPE.bodyStrong, { color: color.ink }]}>{row.owner.slice(0, 5)}…{row.owner.slice(-4)}{row.owner === address ? " · YOU" : ""}</Text><Text style={[TYPE.caption, { color: color.inkMuted }]}>{row.settledTrades} settled · {row.winRatePct}% wins · {row.bestStreak} best streak</Text></View><Text style={[TYPE.data, { color: row.pnlBase < 0n ? color.loss : color.profit }]}>{formatBaseUnits(row.pnlBase, board.meta.decimals, { signed: true, maxDp: 2 })}</Text></View>) : <Note text="No settled traders in this period and ticker yet." />}
      </> : null}
    </ScrollView>
  </>;
}

function Note({ text }: { text: string }) { const { color } = useTheme(); return <Text style={[TYPE.body, { color: color.inkSecondary }]}>{text}</Text>; }
function Action({ label, onPress }: { label: string; onPress: () => void }) { const { color } = useTheme(); return <Pressable onPress={onPress} accessibilityRole="button" style={[styles.chip, { backgroundColor: color.accent }]}><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ body: { padding: SPACE.gutter, paddingTop: 24, paddingBottom: 90, gap: 17 }, kicker: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.5 }, filters: { flexDirection: "row", gap: 8 }, chip: { minHeight: 44, borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 13, justifyContent: "center" }, meta: { borderTopWidth: 1, borderBottomWidth: 1, paddingVertical: 12, gap: 4 }, row: { minHeight: 76, borderWidth: 1, borderRadius: RADIUS.md, padding: 12, flexDirection: "row", alignItems: "center", gap: 9 }, rank: { fontFamily: FONT.dataStrong, fontSize: 18 }, person: { flex: 1, gap: 4 }, error: { gap: 10 } });
