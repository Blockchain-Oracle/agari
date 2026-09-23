import { PARLAY_MAX_LEGS, PARLAY_STAKE_HEADROOM_BPS, type ParlayLegInput, type ParlayReserveState, type ParlayTicket } from "@agari/core/parlay";
import { isOk } from "@agari/core/schemas";
import type { EventMarket, MarketId, Side } from "@agari/core/types";
import { formatBaseUnits, mulBpsCeil, parseDecimalToBaseUnits } from "@agari/core/units";
import { useBalanceSheet, useMyParlays, useParlayReserve } from "@agari/markets/react";
import { Stack } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useParlayQuote } from "@/features/parlay/useParlayQuote";
import { useParlayWindows } from "@/features/parlay/useParlayWindows";
import { useParlayWrites } from "@/features/parlay/useParlayWrites";
import { useWalletSession } from "@/lib/wallet-session";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

export default function ParlayScreen() {
  const { color } = useTheme();
  const read = useParlayReserve();
  const reserve = read && isOk(read) ? read.value : null;
  return <><Stack.Screen options={{ title: "Parlay", headerShown: true }} /><ScrollView style={{ backgroundColor: color.ground }} contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
    <Text style={[styles.kicker, { color: color.accent }]}>COMBINE LIVE WINDOWS</Text><Text style={[TYPE.display, { color: color.ink }]}>Parlay.</Text>
    <Text style={[TYPE.body, { color: color.inkSecondary }]}>Choose two or more live outcomes. The reserve quotes the combined ticket; every leg must win for the full payout.</Text>
    {read === null ? <Note text="Reading the parlay reserve…" /> : !read.ok ? <Note text="The reserve could not be read." /> : !reserve ? <Note text="The parlay reserve is not deployed on this network." /> : <Builder reserve={reserve} />}
  </ScrollView></>;
}

function Builder({ reserve }: { reserve: ParlayReserveState }) {
  const { color } = useTheme();
  const nowMs = useChainNowMs();
  const { windows, loading } = useParlayWindows(nowMs);
  const { address, connect } = useWalletSession();
  const sheet = useBalanceSheet(address);
  const walletBase = sheet && isOk(sheet) ? sheet.value.spendableBase : null;
  const tickets = useMyParlays(address);
  const writes = useParlayWrites();
  const [legs, setLegs] = useState<ParlayLegInput[]>([]);
  const [stake, setStake] = useState("1");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(6);
  const [message, setMessage] = useState<string | null>(null);
  const live = legs.filter((leg) => windows.some((m) => m.marketId === leg.marketId));
  const stakeBase = parseDecimalToBaseUnits(stake || "0", reserve.decimals) ?? 0n;
  const maxLegs = Math.min(PARLAY_MAX_LEGS, reserve.params.maxLegs);
  const visibleWindows = windows.filter((market) => market.asset.toLowerCase().includes(search.trim().toLowerCase()));
  const state = useParlayQuote({ legs: live, mode: { kind: "fixStake", stakeBase }, params: reserve.params, enabled: live.length >= 2 && !reserve.paused });
  const quote = state.quote;
  const cap = quote ? mulBpsCeil(quote.stakeBase, 10_000 + PARLAY_STAKE_HEADROOM_BPS) : null;
  const money = (base: bigint) => `${formatBaseUnits(base, reserve.decimals, { maxDp: 2 })} tUSDC`;
  const add = (market: EventMarket, side: Side) => setLegs((old) => old.length >= maxLegs || old.some((l) => l.marketId === market.marketId) ? old : [...old, { marketId: market.marketId, side }]);
  const place = () => {
    if (!quote || cap === null || walletBase === null || cap > walletBase || live.length < 2) return;
    Alert.alert("Approve this parlay?", `${live.length} live legs\nQuoted stake: ${money(quote.stakeBase)}\nMaximum wallet charge and loss: ${money(cap)}\nMaximum payout if every leg wins: ${money(quote.maxPayoutBase)}\nThe reserve rechecks prices before opening. Your wallet must approve the transaction.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Continue to wallet", onPress: () => void writes.open(live, quote.maxPayoutBase, cap).then((outcome) => {
        setMessage(outcome?.status === "confirmed" ? `Ticket opened · ${outcome.txHash.slice(0, 8)}…` : outcome?.status === "requote" ? "Leg prices changed. Review a fresh quote." : outcome ? `Ticket not opened: ${outcome.status}` : "Wallet signing is unavailable.");
        if (outcome?.status === "confirmed") setLegs([]);
      }) },
    ]);
  };
  return <>
    <Text style={[TYPE.title, { color: color.ink }]}>01 · Your legs ({live.length}/{maxLegs})</Text>
    {live.length ? live.map((leg) => { const market = windows.find((m) => m.marketId === leg.marketId)!; return <Pressable key={leg.marketId} onPress={() => setLegs((old) => old.filter((l) => l.marketId !== leg.marketId))} accessibilityRole="button" accessibilityLabel={`Remove ${market.asset} ${leg.side} leg`} style={[styles.row, { backgroundColor: color.surface1, borderColor: color.hairline }]}><Text style={[TYPE.bodyStrong, { color: color.ink }]}>{market.asset} · {leg.side.toUpperCase()} · {market.intervalSec / 60}m</Text><Text style={[TYPE.caption, { color: color.accent }]}>Remove ×</Text></Pressable>; }) : <Note text="Choose at least two different live Windows below." />}
    <Text style={[TYPE.title, { color: color.ink }]}>02 · Add a live Window</Text>
    <TextInput value={search} onChangeText={(value) => { setSearch(value); setShown(6); }} placeholder="Find a ticker" placeholderTextColor={color.inkMuted} accessibilityLabel="Find a ticker for a parlay leg" style={[styles.search, { color: color.ink, borderColor: color.hairline }]} />
    {loading ? <Note text="Reading live Windows…" /> : !windows.length ? <Note text="No Window can accept a leg right now." /> : !visibleWindows.length ? <Note text="No live Window matches that ticker." /> : visibleWindows.slice(0, shown).map((market) => <View key={market.marketId} style={[styles.row, { backgroundColor: color.surface1, borderColor: color.hairline }]}><View style={styles.rowName}><Text style={[TYPE.bodyStrong, { color: color.ink }]}>{market.asset}</Text><Text style={[TYPE.caption, { color: color.inkMuted }]}>{market.intervalSec / 60}m · closes {new Date(market.expirySec * 1000).toLocaleTimeString()}</Text></View><Pressable onPress={() => add(market, "up")} accessibilityRole="button" accessibilityLabel={`Add ${market.asset} Up`} style={styles.pick}><Text style={[TYPE.bodyStrong, { color: color.profit }]}>↑</Text></Pressable><Pressable onPress={() => add(market, "down")} accessibilityRole="button" accessibilityLabel={`Add ${market.asset} Down`} style={styles.pick}><Text style={[TYPE.bodyStrong, { color: color.loss }]}>↓</Text></Pressable></View>)}
    {visibleWindows.length > shown ? <Pressable onPress={() => setShown((count) => count + 6)} accessibilityRole="button"><Text style={[TYPE.bodyStrong, { color: color.accent }]}>Show more Windows →</Text></Pressable> : null}
    <Text style={[TYPE.title, { color: color.ink }]}>03 · Quote and approve</Text>
    <TextInput value={stake} onChangeText={(value) => setStake(value.replace(/[^0-9.]/g, ""))} keyboardType="decimal-pad" placeholder="Stake in tUSDC" placeholderTextColor={color.inkMuted} accessibilityLabel="Parlay stake in tUSDC" style={[styles.input, { color: color.ink, borderColor: color.hairline }]} />
    <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}>{quote ? <><Text style={[TYPE.dataLg, { color: color.ink }]}>{money(quote.stakeBase)} → {money(quote.maxPayoutBase)}</Text><Text style={[TYPE.body, { color: color.inkSecondary }]}>Maximum loss and wallet charge: {money(cap!)} · {quote.multiplierMilli / 1000}× if all legs win</Text></> : <Note text={state.loading ? "Pricing each leg against the reserve…" : state.error ? state.error.technical : "Add two legs and enter a stake to receive an exact quote."} />}</View>
    {!address ? <Action label="Connect wallet" onPress={connect} /> : <><Text style={[TYPE.caption, { color: color.inkSecondary }]}>Wallet: {walletBase === null ? "reading…" : money(walletBase)}</Text><Action label={writes.busy === "open" ? "Waiting for wallet…" : "Review parlay and sign"} onPress={place} disabled={!quote || reserve.paused || cap === null || walletBase === null || cap > walletBase || writes.busy !== null} /></>}
    {message ? <Note text={message} /> : null}
    <Text style={[TYPE.title, { color: color.ink }]}>Your tickets</Text>
    {!address ? <Note text="Connect to see tickets and claims." /> : tickets === null ? <Note text="Reading your tickets…" /> : !tickets.ok ? <Note text="Tickets could not be read." /> : tickets.value.length ? tickets.value.map((ticket) => <Ticket key={ticket.parlayId.toString()} ticket={ticket} reserve={reserve} nowMs={nowMs} />) : <Note text="No parlay tickets for this wallet." />}
  </>;
}

function Ticket({ ticket, reserve, nowMs }: { ticket: ParlayTicket; reserve: ParlayReserveState; nowMs: number }) {
  const { color } = useTheme();
  const writes = useParlayWrites();
  const money = (base: bigint) => `${formatBaseUnits(base, reserve.decimals, { maxDp: 2 })} tUSDC`;
  const ask = (title: string, run: () => void) => Alert.alert(title, `Ticket #${ticket.parlayId.toString()}\nYour wallet must approve the transaction.`, [{ text: "Cancel", style: "cancel" }, { text: "Continue to wallet", onPress: run }]);
  return <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}><Text style={[TYPE.bodyStrong, { color: color.ink }]}>#{ticket.parlayId.toString()} · {ticket.status.toUpperCase()}</Text><Text style={[TYPE.caption, { color: color.inkSecondary }]}>Stake {money(ticket.stakeBase)} · payout {money(ticket.maxPayoutBase)}</Text>{ticket.legs.map((leg, idx) => <View key={`${leg.marketId}-${idx}`} style={styles.row}><Text style={[TYPE.caption, { color: color.ink }]}>{leg.side.toUpperCase()} · {leg.status} · {new Date(leg.expirySec * 1000).toLocaleString()}</Text>{leg.status === "pending" && leg.expirySec * 1000 < nowMs ? <Pressable onPress={() => ask("Settle this leg?", () => void writes.settleLeg(ticket.parlayId, idx, leg.marketId as MarketId))} accessibilityRole="button"><Text style={[TYPE.caption, { color: color.accent }]}>Settle</Text></Pressable> : null}</View>)}{ticket.status === "won" || ticket.status === "void" ? <Action label={`Claim ${money(ticket.status === "won" ? ticket.maxPayoutBase : ticket.stakeBase)}`} onPress={() => ask("Claim this ticket?", () => void writes.claim(ticket.parlayId, ticket.status === "won" ? ticket.maxPayoutBase : ticket.stakeBase, reserve.decimals, "tUSDC"))} /> : null}</View>;
}
function Note({ text }: { text: string }) { const { color } = useTheme(); return <Text style={[TYPE.body, { color: color.inkSecondary }]}>{text}</Text>; }
function Action({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) { const { color } = useTheme(); return <Pressable disabled={disabled} onPress={onPress} accessibilityRole="button" accessibilityState={{ disabled }} style={[styles.action, { backgroundColor: color.accent, opacity: disabled ? 0.5 : 1 }]}><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>{label}</Text></Pressable>; }
const styles = StyleSheet.create({ body: { padding: SPACE.gutter, paddingTop: 24, paddingBottom: 90, gap: 15 }, kicker: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 1.4 }, row: { minHeight: 54, borderWidth: 1, borderRadius: RADIUS.md, padding: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 }, rowName: { flex: 1, gap: 3 }, pick: { width: 44, height: 44, alignItems: "center", justifyContent: "center" }, input: { height: 52, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 14, fontFamily: FONT.data, fontSize: 22 }, search: { minHeight: 44, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 14, fontFamily: FONT.body, fontSize: 15 }, card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 16, gap: 11 }, action: { minHeight: 50, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", paddingHorizontal: 14 } });
