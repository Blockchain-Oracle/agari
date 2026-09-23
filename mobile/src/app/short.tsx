import { leverageBpsOf, type LeveragePosition, type LeverageReserveState } from "@agari/core/leverage";
import { isOk } from "@agari/core/schemas";
import type { EventMarket } from "@agari/core/types";
import { formatBaseUnits, parseDecimalToBaseUnits } from "@agari/core/units";
import { useBalanceSheet, useLeverageMark, useLeverageReserve, useMyLeveragePositions } from "@agari/markets/react";
import { Stack } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLeverageQuote, useLeverageWrites } from "@/features/leverage";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useShortWindows } from "@/features/short/useShortWindows";
import { useWalletSession } from "@/lib/wallet-session";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

export default function ShortScreen() {
  const { color } = useTheme();
  const reserveRead = useLeverageReserve();
  const reserve = reserveRead && isOk(reserveRead) ? reserveRead.value : null;
  return <><Stack.Screen options={{ title: "Short", headerShown: true }} /><ScrollView style={{ backgroundColor: color.ground }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
    <Text style={[styles.kicker, { color: color.accent }]}>THE INVERSE POSITION</Text><Text style={[TYPE.display, { color: color.ink }]}>Short.</Text>
    <Text style={[TYPE.body, { color: color.inkSecondary }]}>Choose a live Window, enter a stake and read the reserve's quote. The stake is your maximum loss. A position remains open until close, settlement or knock-out.</Text>
    {reserveRead === null ? <Note text="Reading the leverage reserve…" /> : !reserveRead.ok ? <Note text="The reserve read failed. No short can be quoted now." /> : !reserve ? <Note text="The leverage reserve is not deployed on this network." /> : <ShortJourney reserve={reserve} />}
  </ScrollView></>;
}

function ShortJourney({ reserve }: { reserve: LeverageReserveState }) {
  const { color } = useTheme();
  const nowMs = useChainNowMs();
  const { stocks, loading } = useShortWindows(nowMs);
  const { address, connect } = useWalletSession();
  const sheet = useBalanceSheet(address);
  const held = useMyLeveragePositions(address);
  const [picked, setPicked] = useState<EventMarket | null>(null);
  const live = stocks.flatMap((stock) => stock.windows.filter((m) => m.tradingStartSec * 1000 <= nowMs && m.lockAtSec * 1000 > nowMs));
  const market = live.find((m) => m.marketId === picked?.marketId) ?? live[0] ?? null;
  return <>
    <Text style={[TYPE.title, { color: color.ink }]}>01 · Pick a live Window</Text>
    {loading ? <Note text="Reading live Windows…" /> : live.length ? <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontal}>{live.map((m) => <Pressable key={m.marketId} onPress={() => setPicked(m)} accessibilityRole="button" accessibilityState={{ selected: market?.marketId === m.marketId }} style={[styles.chip, { borderColor: market?.marketId === m.marketId ? color.accent : color.hairline, backgroundColor: color.surface1 }]}><Text style={[TYPE.bodyStrong, { color: color.ink }]}>{m.asset} · {m.intervalSec / 60}m</Text></Pressable>)}</ScrollView> : <Note text="No live Window is accepting short positions. Check Markets for the next opening." />}
    {!address ? <Action label="Connect wallet to short" onPress={connect} /> : market ? <ShortTicket market={market} reserve={reserve} walletBase={sheet && isOk(sheet) ? sheet.value.spendableBase : null} /> : null}
    <Text style={[TYPE.title, { color: color.ink }]}>02 · Your positions</Text>
    {!address ? <Note text="Connect a wallet to see and manage your shorts." /> : held === null ? <Note text="Reading your short positions…" /> : !held.ok ? <Note text="Position read failed." /> : held.value.length ? held.value.map((position) => <Position key={position.positionId.toString()} position={position} decimals={reserve.decimals} />) : <Note text="No short positions for this wallet." />}
  </>;
}

function ShortTicket({ market, reserve, walletBase }: { market: EventMarket; reserve: LeverageReserveState; walletBase: bigint | null }) {
  const { color } = useTheme();
  const [amount, setAmount] = useState("");
  const [multiple, setMultiple] = useState(2);
  const [message, setMessage] = useState<string | null>(null);
  const writes = useLeverageWrites();
  const stakeBase = parseDecimalToBaseUnits(amount || "0", reserve.decimals) ?? 0n;
  const state = useLeverageQuote({ market, side: "down", stakeBase, leverageBps: leverageBpsOf(multiple), params: reserve.params, enabled: writes.canSign && !reserve.paused && stakeBase > 0n });
  const q = state.quote;
  const money = (base: bigint) => `${formatBaseUnits(base, reserve.decimals, { maxDp: 2 })} tUSDC`;
  const open = () => {
    if (!q || reserve.paused || walletBase === null || walletBase < q.stakeBase) return;
    Alert.alert("Approve this short?", `${market.asset} · DOWN · ${multiple}×\nExact quoted stake: ${money(q.stakeBase)}\nMaximum loss: ${money(q.stakeBase)}\nIf right at expiry: ${money(q.winIfRightBase)}\nA moved book may require a new quote. Your wallet must approve the transaction.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Continue to wallet", onPress: () => void writes.open({ marketId: market.marketId, side: "down", stakeBase, leverageBps: leverageBpsOf(multiple), minQuantityRaw: q.quantityRaw * 95n / 100n }).then((outcome) => {
        setMessage(outcome?.status === "confirmed" ? `Position opened · ${outcome.txHash.slice(0, 8)}…` : outcome?.status === "requote" ? "The book moved. Review the new quote before approving." : outcome ? `Open failed: ${outcome.diagnosis?.kind ?? outcome.status}` : "Wallet signing is unavailable.");
        if (outcome?.status === "confirmed") setAmount("");
      }) },
    ]);
  };
  return <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
    <View style={styles.head}><AssetDisc asset={market.asset} size={32} /><Text style={[TYPE.title, { color: color.ink }]}>{market.asset} · Down</Text></View>
    <Text style={[TYPE.caption, { color: color.inkSecondary }]}>Wallet: {walletBase === null ? "reading…" : money(walletBase)}</Text>
    <TextInput value={amount} onChangeText={(value) => setAmount(value.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" placeholder="Stake in tUSDC" placeholderTextColor={color.inkMuted} accessibilityLabel="Short stake in tUSDC" style={[styles.input, { color: color.ink, borderColor: color.hairline }]} />
    <View style={styles.horizontal}>{Array.from({ length: Math.max(0, Math.floor(reserve.params.maxLeverageBps / 10_000) - 1) }, (_, i) => i + 2).map((x) => <Pressable key={x} onPress={() => setMultiple(x)} accessibilityRole="button" accessibilityState={{ selected: multiple === x }} style={[styles.chip, { borderColor: x === multiple ? color.accent : color.hairline }]}><Text style={[TYPE.bodyStrong, { color: color.ink }]}>{x}×</Text></Pressable>)}</View>
    <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{q ? `Contracts ${formatBaseUnits(q.quantityRaw, reserve.decimals)} · Return if right ${money(q.winIfRightBase)} · Knock-out line ${money(q.lineBase)}` : state.loading ? "Pricing against the reserve and live book…" : state.error ? state.error.technical : "Enter a stake to see the reserve quote."}</Text>
    {q ? <Text style={[TYPE.bodyStrong, { color: color.ink }]}>Quoted stake and maximum loss: {money(q.stakeBase)}</Text> : null}
    {message ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{message}</Text> : null}
    <Action label={writes.busy === "open" ? "Waiting for wallet…" : "Review short and sign"} onPress={open} disabled={!q || reserve.paused || writes.busy !== null || walletBase === null || walletBase < (q?.stakeBase ?? 0n)} />
  </View>;
}

function Position({ position, decimals }: { position: LeveragePosition; decimals: number }) {
  const { color } = useTheme();
  const markRead = useLeverageMark(position.status === "live" ? position.positionId : null);
  const mark = markRead && isOk(markRead) ? markRead.value : null;
  const writes = useLeverageWrites();
  const money = (base: bigint) => `${formatBaseUnits(base, decimals, { maxDp: 2 })} tUSDC`;
  const confirm = (label: string, act: () => Promise<void>) => Alert.alert(label, `Position ${position.positionId} · ${position.side.toUpperCase()}\nA wallet approval is required.`, [{ text: "Cancel", style: "cancel" }, { text: "Continue to wallet", onPress: () => void act() }]);
  return <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}><Text style={[TYPE.bodyStrong, { color: color.ink }]}>#{position.positionId.toString()} · {position.status.toUpperCase()} · {position.leverageBps / 10_000}×</Text><Text style={[TYPE.caption, { color: color.inkSecondary }]}>Staked {money(position.stakeBase)} · owed {money(position.owedBase)}</Text>{mark ? <Text style={[TYPE.caption, { color: color.inkSecondary }]}>Current mark {money(mark.markBase)} · knock-out line {money(mark.lineBase)}</Text> : position.status === "live" ? <Note text="Current exit mark unavailable." /> : null}{position.status === "live" && mark ? <Action label="Close position" onPress={() => confirm("Close this short?", () => writes.close(position.positionId, position.marketId, mark.markBase * 95n / 100n, decimals, "tUSDC"))} /> : null}{position.status === "live" && Date.now() / 1000 >= position.expirySec ? <Action label="Settle position" onPress={() => confirm("Settle this short?", () => writes.settle(position.positionId, position.marketId))} /> : null}{position.owedBase > 0n ? <Action label={`Claim ${money(position.owedBase)}`} onPress={() => confirm("Claim short proceeds?", () => writes.claim(position.positionId, position.marketId, position.owedBase, decimals, "tUSDC"))} /> : null}</View>;
}
function Note({ text }: { text: string }) { const { color } = useTheme(); return <Text style={[TYPE.body, { color: color.inkSecondary }]}>{text}</Text>; }
function Action({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) { const { color } = useTheme(); return <Pressable disabled={disabled} onPress={onPress} accessibilityRole="button" accessibilityState={{ disabled }} style={[styles.action, { backgroundColor: color.accent, opacity: disabled ? 0.5 : 1 }]}><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ body: { padding: SPACE.gutter, paddingTop: 24, paddingBottom: 90, gap: 17 }, kicker: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.4 }, horizontal: { flexDirection: "row", gap: 8 }, chip: { minHeight: 44, borderWidth: 1, borderRadius: RADIUS.full, paddingHorizontal: 13, justifyContent: "center" }, card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 16, gap: 14 }, head: { flexDirection: "row", alignItems: "center", gap: 10 }, input: { height: 52, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 14, fontFamily: FONT.data, fontSize: 22 }, action: { minHeight: 50, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 } });
