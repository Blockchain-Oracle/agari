import { isOk } from "@agari/core/schemas";
import type { MarketId } from "@agari/core/types";
import { useMarket } from "@agari/markets/react";
import type { PrintProof } from "@agari/markets";
import { Stack, useLocalSearchParams } from "expo-router";
import * as Linking from "expo-linking";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { assetPriceLine } from "@/features/markets/hero/units";
import { useMarketProof } from "@/features/proof/useMarketProof";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

const SOURCE = { pyth: "Pyth", redstone: "RedStone", switchboard: "Switchboard", attested: "Venue-attested" } as const;

export default function PrintProofScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { color } = useTheme();
  const marketId = id as MarketId;
  const marketReading = useMarket(marketId);
  const market = marketReading && isOk(marketReading) ? marketReading.value : null;
  const { reading } = useMarketProof(marketId);
  const prints = reading && isOk(reading) ? reading.value : [];
  return <>
    <Stack.Screen options={{ title: "Print proof", headerShown: true }} />
    <ScrollView style={{ backgroundColor: color.ground }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
      <Text style={[styles.kicker, { color: color.accent }]}>WINDOW RECORD · SOLANA DEVNET</Text><Text style={[styles.title, { color: color.ink }]}>{market?.asset ?? prints[0]?.symbol ?? "Window"} proof.</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>The opening and closing prints recorded for this Window, with their source, boundary time, and on-chain record transaction.</Text>
      {reading === null ? <Note text="Reading signed prints…" /> : !reading.ok ? <Note text="Print proof could not be read right now." /> : !prints.length ? <Note text="No print has been recorded for this Window yet." /> : prints.map((print) => <PrintCard key={print.which} print={print} asset={market?.asset ?? print.symbol ?? ""} />)}
      <View style={[styles.idBox, { borderTopColor: color.hairline }]}><Text style={[styles.kicker, { color: color.inkMuted }]}>WINDOW ADDRESS</Text><Text selectable style={[TYPE.caption, { color: color.inkSecondary }]}>{id}</Text></View>
    </ScrollView>
  </>;
}

function PrintCard({ print, asset }: { print: PrintProof; asset: string }) {
  const { color } = useTheme();
  return <View style={[styles.receipt, { backgroundColor: color.cream, borderColor: color.creamHairline }]}>
    <Text style={[styles.kicker, { color: color.accent }]}>{print.which === 0 ? "01 · OPENING PRINT" : "02 · CLOSING PRINT"}</Text>
    <Text style={[styles.price, { color: color.creamInk }]}>{assetPriceLine(asset, print.priceE8)}</Text>
    <View style={[styles.rows, { borderTopColor: color.creamHairline }]}>
      <Fact label="Source" value={print.source ? SOURCE[print.source] : "Unspecified"} />
      <Fact label="Price boundary" value={new Date(print.boundarySec * 1000).toLocaleString()} />
      <Fact label="Recorded" value={new Date(print.recordedSec * 1000).toLocaleString()} />
      {print.archive ? <Fact label="Archived bytes" value={`${print.archive.payloadBytes} bytes`} /> : null}
      {print.archive?.payloadSha256 ? <Fact label="SHA-256" value={`${print.archive.payloadSha256.slice(0, 12)}…${print.archive.payloadSha256.slice(-8)}`} /> : null}
      {print.replay ? <Fact label="Pyth replay" value={print.replay.state} /> : null}
    </View>
    <Pressable onPress={() => Linking.openURL(`https://explorer.solana.com/tx/${print.recordSignature}?cluster=devnet`)} accessibilityRole="link" style={[styles.explorer, { borderTopColor: color.creamHairline }]}><Text style={[TYPE.bodyStrong, { color: color.accent }]}>View record on Solana Explorer ↗</Text><Text style={[TYPE.caption, { color: color.creamInk }]}>{print.recordSignature.slice(0, 8)}…{print.recordSignature.slice(-6)}</Text></Pressable>
  </View>;
}
function Fact({ label, value }: { label: string; value: string }) { const { color } = useTheme(); return <View style={styles.fact}><Text style={[TYPE.caption, { color: color.creamInk }]}>{label}</Text><Text style={[TYPE.caption, styles.factValue, { color: color.creamInk }]}>{value}</Text></View>; }
function Note({ text }: { text: string }) { const { color } = useTheme(); return <View style={[styles.note, { backgroundColor: color.surface1, borderColor: color.hairline }]}><Text style={[TYPE.body, { color: color.inkSecondary }]}>{text}</Text></View>; }

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, paddingTop: 28, paddingBottom: 110, gap: 16 }, kicker: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.5 }, title: { fontFamily: "Georgia", fontWeight: "700", fontSize: 38, lineHeight: 42, letterSpacing: -2 },
  receipt: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 20, gap: 13, marginTop: 10 }, price: { fontFamily: FONT.dataStrong, fontSize: 30, lineHeight: 35 }, rows: { borderTopWidth: 1, paddingTop: 10, gap: 11 },
  fact: { flexDirection: "row", justifyContent: "space-between", gap: 14 }, factValue: { flex: 1, textAlign: "right" }, explorer: { borderTopWidth: 1, paddingTop: 13, gap: 4 }, note: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 18 }, idBox: { borderTopWidth: 1, paddingTop: 14, gap: 8 },
});
