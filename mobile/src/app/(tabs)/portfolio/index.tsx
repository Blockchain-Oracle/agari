import { isOk } from "@agari/core/schemas";
import { formatBaseUnits } from "@agari/core/units";
import type { OpenPosition } from "@agari/core/types";
import type { SettledRound } from "@agari/core/projection";
import { useBalanceSheet, useClaimables, usePositions, useWalletHistory } from "@agari/markets/react";
import { router } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useWalletSession } from "@/lib/wallet-session";
import { diagnosisCopy } from "@/lib/copy";
import { useClaimAll } from "@/features/markets/claims/useClaimAll";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { TabScreen } from "~/components/shell/TabScreen";
import { marketsEnv } from "~/lib/env";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

/** The spendable number leads; escrow, credit and settled P&L stay separate. */
export default function PortfolioScreen() {
  const { color } = useTheme();
  const { address, connect } = useWalletSession();
  const balance = useBalanceSheet(address);
  const positions = usePositions(address);
  const claims = useClaimables(address, marketsEnv.venueId ?? null);
  const history = useWalletHistory(address);
  const claimRun = useClaimAll();
  const sheet = balance && isOk(balance) ? balance.value : null;
  const open = positions && isOk(positions) ? positions.value : [];
  const claimable = claims && isOk(claims) ? claims.value : [];
  const rounds = history && isOk(history) ? history.value.rounds : [];
  const money = (base: bigint, decimals = sheet?.decimals ?? 6) => formatBaseUnits(base, decimals, { maxDp: 2, minDp: 2 });
  const claimTotal = claimable.reduce((sum, row) => sum + row.netPayoutBase, 0n);

  return <TabScreen><ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.body}>
    {!address ? <View style={styles.empty}>
      <Text style={[styles.kicker, { color: color.accent }]}>YOUR ACCOUNT</Text>
      <Text style={[styles.title, { color: color.ink }]}>{"Your position\nin the market."}</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>Connect a wallet to see spendable test funds, open calls, claimable results and your record. You can browse Markets first.</Text>
      <Action label="Connect wallet" onPress={connect} />
      <Pressable onPress={() => router.navigate("/markets")} accessibilityRole="link"><Text style={[TYPE.bodyStrong, { color: color.accent }]}>Explore markets →</Text></Pressable>
    </View> : <>
      <View style={[styles.balance, { backgroundColor: color.cream, borderColor: color.creamHairline }]}>
        <Text style={[styles.kicker, { color: color.creamInk }]}>WALLET · SOLANA DEVNET</Text>
        <Text style={[styles.balanceNumber, { color: color.creamInk }]}>{sheet ? money(sheet.spendableBase) : "—"}</Text>
        <Text style={[TYPE.caption, { color: color.creamInk }]}>tUSDC in wallet · separate from trading balance and venue credit</Text>
        {balance && !balance.ok ? <Text style={[TYPE.caption, { color: color.loss }]}>Balance read failed. Amounts below are unavailable.</Text> : null}
        <View style={[styles.balanceRows, { borderTopColor: color.creamHairline }]}>
          <BalanceRow label="Trading account" amount={sheet ? sheet.vaultBase === null ? "—" : money(sheet.vaultBase) : "—"} />
          <BalanceRow label="Order escrow · recent seats" amount={sheet ? money(sheet.orderEscrowBase) : "—"} />
          <BalanceRow label="Venue credit · recent seats" amount={sheet ? money(sheet.venueCreditBase) : "—"} />
          <BalanceRow label="SOL for network fees" amount={sheet ? `${formatBaseUnits(sheet.nativeLamports, 9, { maxDp: 4 })} SOL` : "—"} />
        </View>
        <Text style={[TYPE.caption, { color: color.creamInk }]}>Escrow and credit reads cover the ten most recent ledgers; they are not account totals.</Text>
        <Pressable onPress={() => router.push("/funds")} accessibilityRole="button" style={[styles.addButton, { backgroundColor: color.accent }]}><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>Add test funds</Text><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>＋</Text></Pressable>
      </View>
      <SectionHead index="01" title="Open calls" count={positions && isOk(positions) ? open.length : null} />
      {positions === null ? <Note text="Reading open positions…" /> : !positions.ok ? <Note text="Open positions could not be read." /> : open.length ? open.map((position) => <PositionRow key={position.marketId} position={position} />) : <Note text="No open calls yet. Find a Window and make your first call." action="Browse Markets →" onPress={() => router.navigate("/markets")} />}
      <SectionHead index="02" title="To collect" count={claims && isOk(claims) ? claimable.length : null} />
      {claimable.length ? <View style={[styles.claimBox, { backgroundColor: color.surface1, borderColor: color.hairline }]}><Text style={[TYPE.body, { color: color.inkSecondary }]}>{claimable.length} settled result{claimable.length === 1 ? "" : "s"} waiting for collection</Text><Text style={[TYPE.dataLg, { color: color.profit }]}>{money(claimTotal, claimable[0]?.decimals)} tUSDC</Text>{claimable.map((row) => <Pressable key={row.marketId} onPress={() => router.push({ pathname: "/markets/[id]", params: { id: row.marketId } })} accessibilityRole="link"><Text style={[TYPE.bodyStrong, { color: color.accent }]}>{row.asset} · View Window →</Text></Pressable>)}<Text style={[TYPE.caption, { color: color.inkMuted }]}>Each Window needs its own wallet approval. Devnet fees require SOL.</Text><Pressable disabled={!claimRun.hasSigner || claimRun.run.status === "running"} onPress={() => void claimRun.claimAll(claimable)} accessibilityRole="button" style={[styles.addButton, { backgroundColor: color.accent, opacity: claimRun.hasSigner && claimRun.run.status !== "running" ? 1 : 0.5 }]}><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>{claimRun.run.status === "running" ? "Collecting…" : `Collect ${claimable.length} result${claimable.length === 1 ? "" : "s"}`}</Text><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>→</Text></Pressable>{claimRun.run.diagnosis ? <Text style={[TYPE.caption, { color: color.loss }]}>{diagnosisCopy(claimRun.run.diagnosis.kind).headline}</Text> : null}</View> : <Note text={claims === null ? "Reading settled results…" : claims.ok ? "Nothing to collect right now." : "Results could not be read."} />}
      <SectionHead index="03" title="Recent record" count={history && isOk(history) ? rounds.length : null} />
      {rounds.length ? rounds.slice(0, 6).map((round) => <HistoryRow key={round.marketId} round={round} />) : <Note text={history === null ? "Reading your record…" : history.ok ? "Your settled calls will appear here." : "Your record could not be read."} />}
    </>}
  </ScrollView></TabScreen>;
}

function BalanceRow({ label, amount }: { label: string; amount: string }) { const { color } = useTheme(); return <View style={styles.balanceRow}><Text style={[TYPE.caption, { color: color.creamInk }]}>{label}</Text><Text style={[TYPE.data, { color: color.creamInk }]}>{amount}</Text></View>; }
function SectionHead({ index, title, count }: { index: string; title: string; count: number | null }) { const { color } = useTheme(); return <View style={[styles.sectionHead, { borderTopColor: color.hairline }]}><Text style={[styles.kicker, { color: color.accent }]}>{index}</Text><Text style={[TYPE.title, styles.sectionTitle, { color: color.ink }]}>{title}</Text><Text style={[TYPE.data, { color: color.inkMuted }]}>{count ?? "—"}</Text></View>; }
function Note({ text, action, onPress }: { text: string; action?: string; onPress?: () => void }) { const { color } = useTheme(); return <View style={[styles.note, { backgroundColor: color.surface1, borderColor: color.hairline }]}><Text style={[TYPE.body, { color: color.inkSecondary }]}>{text}</Text>{action && onPress ? <Pressable onPress={onPress} accessibilityRole="link"><Text style={[TYPE.bodyStrong, { color: color.accent }]}>{action}</Text></Pressable> : null}</View>; }
function Action({ label, onPress }: { label: string; onPress: () => void }) { const { color } = useTheme(); return <Pressable onPress={onPress} accessibilityRole="button" style={[styles.addButton, { backgroundColor: color.accent }]}><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>{label}</Text><Text style={[TYPE.bodyStrong, { color: color.onAccent }]}>→</Text></Pressable>; }
function PositionRow({ position }: { position: OpenPosition }) { const { color } = useTheme(); const side = position.balanceUpRaw > 0n && position.balanceDownRaw > 0n ? "UP + DOWN" : position.balanceUpRaw > 0n ? "UP" : "DOWN"; return <Pressable onPress={() => router.push({ pathname: "/markets/[id]", params: { id: position.marketId } })} accessibilityRole="link" style={[styles.row, { backgroundColor: color.surface1, borderColor: color.hairline }]}><AssetDisc asset={position.asset} size={32} /><View style={styles.rowMain}><Text style={[TYPE.bodyStrong, { color: color.ink }]}>{position.asset} · {side}</Text><Text style={[TYPE.caption, { color: color.inkMuted }]}>{position.intervalSec / 60}m Window · estimated P&amp;L</Text></View><Text style={[TYPE.data, { color: position.unrealizedPnlBase >= 0n ? color.profit : color.loss }]}>{formatBaseUnits(position.unrealizedPnlBase, position.decimals, { signed: true })}</Text></Pressable>; }
function HistoryRow({ round }: { round: SettledRound }) { const { color } = useTheme(); return <Pressable onPress={() => router.push({ pathname: "/markets/[id]", params: { id: round.marketId } })} accessibilityRole="link" style={[styles.row, { backgroundColor: color.surface1, borderColor: color.hairline }]}><AssetDisc asset={round.asset} size={32} /><View style={styles.rowMain}><Text style={[TYPE.bodyStrong, { color: color.ink }]}>{round.asset} · {round.outcome.toUpperCase()}</Text><Text style={[TYPE.caption, { color: color.inkMuted }]}>{round.claim === "to-collect" ? "To collect" : "Settled"}</Text></View><Text style={[TYPE.data, { color: round.pnlBase >= 0n ? color.profit : color.loss }]}>{formatBaseUnits(round.pnlBase, round.decimals, { signed: true })}</Text></Pressable>; }

const styles = StyleSheet.create({
  body: { padding: SPACE.gutter, paddingTop: 24, paddingBottom: 130, gap: 11 }, empty: { paddingTop: 60, gap: 22 },
  kicker: { fontFamily: FONT.data, fontSize: 10, letterSpacing: 2 }, title: { fontFamily: "Georgia", fontWeight: "700", fontSize: 44, lineHeight: 47, letterSpacing: -2 },
  balance: { padding: 20, borderWidth: 1, borderRadius: RADIUS.lg, gap: 8, marginBottom: 16 }, balanceNumber: { fontFamily: FONT.dataStrong, fontSize: 42, lineHeight: 48, marginTop: 12 },
  balanceRows: { borderTopWidth: 1, marginTop: 16, paddingTop: 10, gap: 6 }, balanceRow: { flexDirection: "row", justifyContent: "space-between" },
  addButton: { height: 50, paddingHorizontal: 17, borderRadius: RADIUS.md, marginTop: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  sectionHead: { borderTopWidth: 1, marginTop: 17, paddingTop: 16, flexDirection: "row", alignItems: "center", gap: 14 }, sectionTitle: { flex: 1 },
  note: { padding: 16, borderRadius: RADIUS.lg, borderWidth: 1, gap: 10 }, claimBox: { padding: 16, borderRadius: RADIUS.lg, borderWidth: 1, gap: 12 },
  row: { minHeight: 68, borderRadius: RADIUS.md, borderWidth: 1, padding: 12, flexDirection: "row", alignItems: "center", gap: 10 }, rowMain: { flex: 1, gap: 3 },
});
