import { formatCadence } from "@agari/core/copy";
import { SymbolView } from "expo-symbols";
import type { ReactNode } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { assetPriceLine } from "@/features/markets/hero/units";
import { STRATEGIES } from "@/features/strategies/copy";
import { DECISION } from "@/features/strategies/decision-copy";
import { fillPriceCents, when, windowSpan } from "@/features/strategies/decision-format";
import { money } from "@/features/strategies/format";
import { shortAddress } from "@/features/strategies/names";
import type { DecisionWire, FillWire } from "@/features/strategies/protocol";
import { explorerUrl, openExternal } from "~/lib/external";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

const M = STRATEGIES.drawer.memory;

/**
 * One agent decision, whole (web's features/strategies/DecisionDetail.tsx, which is a bottom sheet on a phone): the
 * Window, the model's read, the gate's ruling, the copies it placed and how the Window settled, each transaction
 * opening on Solana Explorer.
 */
export function DecisionDetail({ decision, agentName, decimals, symbol, nowMs, onClose }: {
  decision: DecisionWire | null;
  agentName: string;
  decimals: number;
  symbol: string;
  nowMs: number;
  onClose: () => void;
}) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={decision !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.fill, { backgroundColor: color.ground }]}>
        <View style={styles.head}>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel={DECISION.close} hitSlop={8} style={[styles.close, { backgroundColor: color.surface1 }]}>
            <SymbolView name={{ ios: "xmark", android: "close" }} size={14} tintColor={color.ink} />
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.body, { paddingBottom: insets.bottom + 32 }]}>
          {decision ? <Body d={decision} agentName={agentName} decimals={decimals} symbol={symbol} nowMs={nowMs} /> : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Body({ d, agentName, decimals, symbol, nowMs }: { d: DecisionWire; agentName: string; decimals: number; symbol: string; nowMs: number }) {
  const { color } = useTheme();
  const asset = d.asset ?? null;
  const title = asset && d.intervalSec !== null ? DECISION.window(asset, formatCadence(d.intervalSec)) : DECISION.unknownWindow;
  const call = d.verdictSide === "none" ? M.noAnswer : M.call(d.verdictSide, d.confidence);
  const ruling = d.gate === "trade" && d.side ? M.sent(d.side, d.filled) : M.held;
  const print = (raw: string | null | undefined) => (raw && asset ? assetPriceLine(asset, BigInt(raw)) : "—");
  const trades = d.trades ?? [];
  const outcomeInk = d.outcome === "won" ? color.accent : d.outcome === "lost" ? color.inkSecondary : color.inkMuted;
  return (
    <>
      <Text style={[TYPE.labelMicro, { color: color.accent }]}>
        {DECISION.eyebrow} · {agentName}
      </Text>
      <Text style={[TYPE.headline, { color: color.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {d.outcome ? <Text style={[TYPE.labelMicro, { color: outcomeInk }]}>{M.outcome[d.outcome]}</Text> : null}

      <Section title={DECISION.sections.window}>
        {d.window ? <Row label={DECISION.rows.trading} value={windowSpan(d.window.startSec, d.window.expirySec, nowMs)} /> : null}
        <Row label={DECISION.rows.opening} value={print(d.openingRaw)} />
        <Row label={DECISION.rows.closing} value={d.closingRaw ? print(d.closingRaw) : DECISION.pending} />
      </Section>

      <Section title={DECISION.sections.read}>
        <Row label={DECISION.rows.decided} value={when(d.decidedAtMs)} />
        <Row label={DECISION.rows.call} value={call} />
        <Row label={DECISION.rows.model} value={d.model} />
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>“{d.why}”</Text>
      </Section>

      <Section title={DECISION.sections.gate}>
        <Row label={DECISION.rows.ruling} value={ruling} accent={d.gate === "trade"} />
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{d.gateReason}</Text>
      </Section>

      <Section title={DECISION.sections.trades}>
        {trades.length > 0 ? (
          trades.map((t) => <TradeRow key={t.txHash} t={t} decimals={decimals} symbol={symbol} />)
        ) : (
          <Text style={[TYPE.caption, { color: color.inkMuted }]}>{d.gate === "trade" && d.filled > 0 ? DECISION.tradesUnlisted : DECISION.noTrades}</Text>
        )}
      </Section>

      <Section title={DECISION.sections.settlement}>
        <Row label={DECISION.rows.outcome} value={d.outcome && d.outcome !== "open" ? M.outcome[d.outcome] : DECISION.pending} />
        {d.settleTx ? <Link label={`${DECISION.rows.settledTx} ↗`} url={explorerUrl("tx", d.settleTx)} /> : null}
      </Section>
    </>
  );
}

function TradeRow({ t, decimals, symbol }: { t: FillWire; decimals: number; symbol: string }) {
  const { color } = useTheme();
  const price = fillPriceCents(t.cashDeltaBase, t.tokenDeltaRaw);
  return (
    <View style={[styles.trade, { backgroundColor: color.surface1, borderColor: color.hairline }]}>
      <View style={styles.tradeHead}>
        <Text style={[styles.side, { color: t.side === "up" ? color.profit : color.loss }]}>{DECISION.trade.side(t.side)}</Text>
        <Text style={[styles.mono, { color: color.inkMuted }]}>
          {DECISION.trade.copier} {shortAddress(t.owner)}
        </Text>
      </View>
      <Row label={DECISION.trade.stake} value={money(BigInt(t.cashDeltaBase), decimals, symbol)} />
      <Row label={DECISION.trade.shares} value={money(BigInt(t.tokenDeltaRaw), decimals)} />
      <Row label={DECISION.trade.price} value={price === null ? "—" : `${price}¢`} />
      {t.payoutBase !== null ? <Row label={DECISION.trade.payout} value={money(BigInt(t.payoutBase), decimals, symbol)} /> : null}
      <Link label={DECISION.explorer} url={explorerUrl("tx", t.txHash)} />
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { color } = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: color.hairline }]}>
      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{title}</Text>
      {children}
    </View>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  const { color } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[TYPE.data, styles.value, { color: accent ? color.accent : color.ink }]}>{value}</Text>
    </View>
  );
}

function Link({ label, url }: { label: string; url: string }) {
  const { color } = useTheme();
  return (
    <Pressable onPress={() => void openExternal(url)} accessibilityRole="link" hitSlop={6}>
      <Text style={[TYPE.caption, { color: color.accent }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  head: { flexDirection: "row", justifyContent: "flex-end", padding: 16, paddingBottom: 0 },
  close: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  body: { paddingHorizontal: 20, paddingTop: 4, gap: 10 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 14, marginTop: 8, gap: 8 },
  row: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 12 },
  value: { flexShrink: 1, textAlign: "right" },
  trade: { borderWidth: StyleSheet.hairlineWidth, borderRadius: RADIUS.md, padding: 12, gap: 6 },
  tradeHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  side: { fontFamily: FONT.dataStrong, fontSize: 13, letterSpacing: 0.8 },
  mono: { fontFamily: FONT.data, fontSize: 10.5 },
});
