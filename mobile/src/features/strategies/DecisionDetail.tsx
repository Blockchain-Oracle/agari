import { formatCadence } from "@agari/core/copy";
import type { Signature } from "@agari/core/types";
import { txUrl } from "@agari/core/urls";
import { BlurView } from "expo-blur";
import { X } from "lucide-react-native";
import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { assetPriceLine } from "@/features/markets/hero/units";
import { STRATEGIES } from "@/features/strategies/copy";
import { DECISION } from "@/features/strategies/decision-copy";
import { fillPriceCents, when, windowSpan } from "@/features/strategies/decision-format";
import { money } from "@/features/strategies/format";
import { shortAddress } from "@/features/strategies/names";
import type { DecisionWire, FillWire } from "@/features/strategies/protocol";
import { openExternal } from "~/lib/external";
import { FONT } from "~/theme";
import { ST, useStrat } from "./ui";

const M = STRATEGIES.drawer.memory;

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { color } = useStrat();
  return (
    <View style={[styles.section, { borderTopColor: color.hairline }]}>
      <Text style={[styles.sectionTitle, { color: color.inkMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { color } = useStrat();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: accent ? color.accent : color.ink }]}>{value}</Text>
    </View>
  );
}

function Link({ label, hash }: { label: string; hash: string }) {
  const { color } = useStrat();
  return (
    <Pressable accessibilityRole="link" onPress={() => void openExternal(txUrl(hash as Signature))}>
      <Text style={[styles.link, { color: color.accent }]}>{label}</Text>
    </Pressable>
  );
}

function TradeRow({ t: trade, decimals, symbol, last }: { t: FillWire; decimals: number; symbol: string; last: boolean }) {
  const { t, color } = useStrat();
  const price = fillPriceCents(trade.cashDeltaBase, trade.tokenDeltaRaw);
  const facts: [string, string][] = [
    [DECISION.trade.stake, money(BigInt(trade.cashDeltaBase), decimals, symbol)],
    [DECISION.trade.shares, money(BigInt(trade.tokenDeltaRaw), decimals)],
    [DECISION.trade.price, price === null ? "—" : `${price}¢`],
    ...(trade.payoutBase !== null ? [[DECISION.trade.payout, money(BigInt(trade.payoutBase), decimals, symbol)] as [string, string]] : []),
  ];
  return (
    <View style={[styles.trade, !last && { borderBottomWidth: 1, borderBottomColor: color.hairline }]}>
      <View style={styles.tradeHead}>
        <Text style={[styles.side, { color: trade.side === "up" ? color.profit : color.loss }]}>{DECISION.trade.side(trade.side)}</Text>
        <Text style={[ST.mono10, { color: t.ink(0.4) }]}>
          {DECISION.trade.copier} {shortAddress(trade.owner)}
        </Text>
      </View>
      <View style={styles.facts}>
        {facts.map(([dt, dd]) => (
          <View key={dt} style={styles.fact}>
            <Text style={[styles.dt, { color: color.inkMuted }]}>{dt}</Text>
            <Text style={[styles.dd, { color: color.ink }]}>{dd}</Text>
          </View>
        ))}
      </View>
      <Link label={DECISION.explorer} hash={trade.txHash} />
    </View>
  );
}

/**
 * web's features/strategies/DecisionDetail.tsx on a phone: decision.css's bottom sheet with its grab bar over the
 * scrim — the Window, the model's read, the gate's ruling, the copies placed and the settlement, each tx linked.
 */
export function DecisionDetail({ decision, agentName, decimals, symbol, nowMs, onClose }: {
  decision: DecisionWire | null; agentName: string; decimals: number; symbol: string; nowMs: number; onClose: () => void;
}) {
  const { t, color } = useStrat();
  const insets = useSafeAreaInsets();
  const d = decision;
  return (
    <Modal visible={d !== null} transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.fill}>
        <Animated.View entering={FadeIn.duration(200)} style={StyleSheet.absoluteFill}>
          <BlurView intensity={12} style={StyleSheet.absoluteFill} />
          <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }]} onPress={onClose} accessibilityLabel={DECISION.close} />
        </Animated.View>
        <Animated.View entering={SlideInDown.duration(320)} style={[styles.popup, { backgroundColor: color.ground, borderTopColor: t.popupBorder, boxShadow: t.sheetShadow }]}>
          <View style={[styles.bar, { backgroundColor: t.grabBar }]} />
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={DECISION.close} style={styles.close} hitSlop={6}>
            <X size={16} color={color.inkDisabled} />
          </Pressable>
          <ScrollView contentContainerStyle={[styles.body, { paddingBottom: 24 + insets.bottom }]}>{d ? <Body d={d} agentName={agentName} decimals={decimals} symbol={symbol} nowMs={nowMs} /> : null}</ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Body({ d, agentName, decimals, symbol, nowMs }: { d: DecisionWire; agentName: string; decimals: number; symbol: string; nowMs: number }) {
  const { t, color } = useStrat();
  const asset = d.asset ?? null;
  const title = asset && d.intervalSec !== null ? DECISION.window(asset, formatCadence(d.intervalSec)) : DECISION.unknownWindow;
  const call = d.verdictSide === "none" ? M.noAnswer : M.call(d.verdictSide, d.confidence);
  const ruling = d.gate === "trade" && d.side ? M.sent(d.side, d.filled) : M.held;
  const print = (raw: string | null | undefined) => (raw && asset ? assetPriceLine(asset, BigInt(raw)) : "—");
  const trades = d.trades ?? [];
  const won = d.outcome === "won";
  return (
    <>
      <Text style={[ST.meta, styles.eyebrow, { color: color.accent }]}>
        {DECISION.eyebrow} · {agentName}
      </Text>
      <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {d.outcome ? (
        <Text style={[styles.outcome, won ? { borderColor: t.vermilionA(0.5), color: t.vermilion } : { borderColor: t.directionBorder, color: color.inkSecondary }]}>{M.outcome[d.outcome]}</Text>
      ) : null}
      <Section title={DECISION.sections.window}>
        {d.window ? <Row label={DECISION.rows.trading} value={windowSpan(d.window.startSec, d.window.expirySec, nowMs)} /> : null}
        <Row label={DECISION.rows.opening} value={print(d.openingRaw)} />
        <Row label={DECISION.rows.closing} value={d.closingRaw ? print(d.closingRaw) : DECISION.pending} />
      </Section>
      <Section title={DECISION.sections.read}>
        <Row label={DECISION.rows.decided} value={when(d.decidedAtMs)} />
        <Row label={DECISION.rows.call} value={call} />
        <Row label={DECISION.rows.model} value={d.model} />
        <Text style={[styles.why, { color: t.gray300 }]}>“{d.why}”</Text>
      </Section>
      <Section title={DECISION.sections.gate}>
        <Row label={DECISION.rows.ruling} value={ruling} accent={d.gate === "trade"} />
        <Text style={[styles.note, { color: color.inkMuted }]}>{d.gateReason}</Text>
      </Section>
      <Section title={DECISION.sections.trades}>
        {trades.length > 0 ? (
          trades.map((tr, i) => <TradeRow key={tr.txHash} t={tr} decimals={decimals} symbol={symbol} last={i === trades.length - 1} />)
        ) : (
          <Text style={[styles.note, { color: color.inkMuted }]}>{d.gate === "trade" && d.filled > 0 ? DECISION.tradesUnlisted : DECISION.noTrades}</Text>
        )}
      </Section>
      <Section title={DECISION.sections.settlement}>
        <Row label={DECISION.rows.outcome} value={d.outcome && d.outcome !== "open" ? M.outcome[d.outcome] : DECISION.pending} />
        {d.settleTx ? <Link label={`${DECISION.rows.settledTx} ↗`} hash={d.settleTx} /> : null}
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  popup: { maxHeight: "88%", borderTopWidth: 1, borderTopLeftRadius: 16, borderTopRightRadius: 16, overflow: "hidden" },
  bar: { position: "absolute", top: 10, left: "50%", width: 40, height: 4, marginLeft: -20, borderRadius: 9999, zIndex: 2 },
  close: { position: "absolute", right: 16, top: 16, padding: 8, borderRadius: 9999, zIndex: 2 },
  body: { paddingTop: 28, paddingHorizontal: 20 },
  eyebrow: { marginBottom: 6, letterSpacing: 1.8 },
  title: { fontFamily: FONT.headingHeavy, fontSize: 20, lineHeight: 23, paddingRight: 32 },
  outcome: { alignSelf: "flex-start", marginTop: 8, borderRadius: 9999, borderWidth: 1, paddingVertical: 2, paddingHorizontal: 10, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.4, textTransform: "uppercase", overflow: "hidden" },
  section: { marginTop: 20, paddingTop: 14, borderTopWidth: 1 },
  sectionTitle: { marginBottom: 8, fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.6, textTransform: "uppercase" },
  row: { flexDirection: "row", justifyContent: "space-between", gap: 12, paddingVertical: 4 },
  rowLabel: { fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8, flexShrink: 0 },
  rowValue: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 20.8, textAlign: "right", flexShrink: 1 },
  why: { marginTop: 8, fontFamily: FONT.body, fontSize: 13, lineHeight: 20.15 },
  note: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 16.5 },
  trade: { paddingVertical: 10 },
  tradeHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  side: { fontFamily: FONT.dataStrong, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.32 },
  facts: { flexDirection: "row", flexWrap: "wrap", rowGap: 6, columnGap: 16, marginVertical: 8 },
  fact: { width: "45%", flexGrow: 1 },
  dt: { fontFamily: FONT.body, fontSize: 11, lineHeight: 17.6 },
  dd: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  link: { marginTop: 4, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
});
