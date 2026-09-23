import { isOk } from "@agari/core/schemas";
import { router, Stack } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { assetPriceLine } from "@/features/markets/hero/units";
import { useProofFeed } from "@/features/proof/useProofFeed";
import type { FeedRow } from "@/features/proof/feed";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/** Native index of the same signed Window prints shown on web Proof. */
export default function ProofFeedScreen() {
  const { color } = useTheme();
  const reading = useProofFeed();
  const [source, setSource] = useState("All");
  const [shown, setShown] = useState(30);
  const rows = reading && isOk(reading) ? reading.value : [];
  const sources = [...new Set(rows.map((row) => row.sourceName).filter((name): name is string => Boolean(name)))];
  const active = source === "All" || sources.includes(source) ? source : "All";
  const filtered = active === "All" ? rows : rows.filter((row) => row.sourceName === active);
  return <>
    <Stack.Screen options={{ title: "Proof", headerShown: true }} />
    <ScrollView style={{ backgroundColor: color.ground }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
      <Text style={[styles.kicker, { color: color.accent }]}>00 · SETTLEMENT PROOF</Text><Text style={[styles.title, { color: color.ink }]}>The price decides.</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>Every settled Window, newest first. Open a result to see the signed opening and closing prints and their record transactions.</Text>
      {sources.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>{["All", ...sources].map((name) => <Pressable key={name} onPress={() => { setSource(name); setShown(30); }} accessibilityRole="tab" accessibilityState={{ selected: active === name }} style={[styles.filter, { borderColor: color.hairline, backgroundColor: active === name ? color.ink : color.surface1 }]}><Text style={[TYPE.caption, { color: active === name ? color.ground : color.ink }]}>{name}</Text></Pressable>)}</ScrollView> : null}
      {reading === null ? <Note text="Reading settled Windows…" /> : !reading.ok ? <Note text="The index is unavailable. The prints remain on chain and this list returns when the index answers." /> : filtered.length === 0 ? <Note text="No settled Windows in this view yet." /> : <>
        <Text style={[styles.kicker, { color: color.inkMuted }]}>{Math.min(shown, filtered.length)} OF {filtered.length} WINDOWS</Text>
        {filtered.slice(0, shown).map((row) => <ProofRow key={row.market} row={row} />)}
        {filtered.length > shown ? <Pressable onPress={() => setShown((value) => value + 30)} accessibilityRole="button" style={[styles.more, { borderColor: color.hairline }]}><Text style={[TYPE.bodyStrong, { color: color.accent }]}>Show more →</Text></Pressable> : null}
      </>}
    </ScrollView>
  </>;
}

function ProofRow({ row }: { row: FeedRow }) {
  const { color } = useTheme();
  const outcomeColor = row.outcome === "up" ? color.profit : row.outcome === "down" ? color.loss : color.inkMuted;
  return <Pressable onPress={() => router.push({ pathname: "/proof/[id]", params: { id: row.market } })} accessibilityRole="link" style={({ pressed }) => [styles.row, { borderColor: color.hairline, backgroundColor: color.surface1, opacity: pressed ? 0.8 : 1 }]}>
    <View style={styles.rowHead}><AssetDisc asset={row.asset} size={32} /><View style={styles.rowName}><Text style={[TYPE.bodyStrong, { color: color.ink }]}>{row.asset} · {row.cadenceSec / 60}m</Text><Text style={[TYPE.caption, { color: color.inkMuted }]}>{new Date(row.expirySec * 1000).toLocaleString()}</Text></View><Text style={[styles.outcome, { color: outcomeColor }]}>{row.outcome === "void" ? "VOID" : `${row.outcome.toUpperCase()} WON`}</Text></View>
    <Text style={[TYPE.data, { color: color.ink }]}>{row.openE8 === null ? "—" : assetPriceLine(row.asset, row.openE8)} → {row.closeE8 === null ? "—" : assetPriceLine(row.asset, row.closeE8)}</Text>
    <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{row.sourceName ?? "Source pending"} · See print records →</Text>
  </Pressable>;
}
function Note({ text }: { text: string }) { const { color } = useTheme(); return <View style={[styles.row, { borderColor: color.hairline, backgroundColor: color.surface1 }]}><Text style={[TYPE.body, { color: color.inkSecondary }]}>{text}</Text></View>; }

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, paddingTop: 28, paddingBottom: 110, gap: 14 }, kicker: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.6 }, title: { fontFamily: "Georgia", fontWeight: "700", fontSize: 38, lineHeight: 42, letterSpacing: -2 },
  filters: { gap: 8, paddingVertical: 8 }, filter: { minHeight: 36, borderRadius: RADIUS.full, borderWidth: 1, justifyContent: "center", paddingHorizontal: 14 },
  row: { borderRadius: RADIUS.md, borderWidth: 1, padding: 15, gap: 11 }, rowHead: { flexDirection: "row", alignItems: "center", gap: 10 }, rowName: { flex: 1, gap: 2 }, outcome: { fontFamily: FONT.dataStrong, fontSize: 10 }, more: { borderWidth: 1, height: 46, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
});
