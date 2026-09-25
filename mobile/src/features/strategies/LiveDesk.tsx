import { parseStrategyMetadata } from "@agari/core/strategies";
import { StyleSheet, Text, View } from "react-native";
import { money } from "@/features/strategies/format";
import { strategyIdentity, STRATEGY_MARKETS } from "@/features/strategies/identity";
import { COPY_STATE_LABEL } from "@/features/strategies/lifecycle";
import type { StrategiesPayload } from "@/features/strategies/protocol";
import type { DeskModel } from "@/features/strategies/useDesk";
import { FONT } from "~/theme";
import { AgentPortrait } from "./AgentPortrait";
import { RecordCard } from "./RecordCard";
import { StrategyActivity } from "./StrategyActivity";
import { PrimaryButton, ST, useStrat } from "./ui";

/** web's features/strategies/LiveDesk.tsx (desk.css `.desk`): the selected strategy, its consent state, the runner's report. */
export function LiveDesk({ payload, desk, nowMs, onManage }: { payload: StrategiesPayload; desk: DeskModel; nowMs: number; onManage: () => void }) {
  const { t, color } = useStrat();
  const card = desk.featured;
  if (!card) return null;
  const { name, seed } = strategyIdentity(card);
  const { decimals, symbol } = payload;
  const health = desk.health?.ok && !desk.health.stale && desk.health.value.reachable ? desk.health.value.strategies[card.strategyId] ?? null : null;
  const spec = parseStrategyMetadata(card.metadata)?.spec;
  const what = spec?.preset === "agent" ? "AI judgment with enforced limits" : spec?.preset === "reversion" ? "Opening-price reversion rule" : "Opening-price momentum rule";
  return (
    <View accessibilityLabel="Selected strategy" style={[styles.desk, { borderColor: t.ink(0.1), backgroundColor: color.ground }]}>
      <View style={styles.head}>
        <AgentPortrait seed={seed} name={name} />
        <View style={styles.headText}>
          <Text style={[styles.name, { color: color.ink }]}>{name}</Text>
          <Text style={[styles.what, { color: t.ink(0.7) }]}>
            {what} · {STRATEGY_MARKETS}
          </Text>
        </View>
      </View>
      <View style={styles.mt24}>
        <RecordCard record={card.record} decimals={decimals} symbol={symbol} />
      </View>
      <View style={styles.pulse}>
        <Text style={[ST.deskStatus, { color: color.accent }]}>{COPY_STATE_LABEL[desk.state]}</Text>
        <StrategyActivity state={desk.state} grant={desk.grant} health={health} nowMs={nowMs} style={styles.mt12} />
      </View>
      {desk.grant ? (
        <View style={[styles.numbers, { borderColor: t.ink(0.08), backgroundColor: t.ink(0.02) }]}>
          <View style={styles.numberCell}>
            <Text style={[ST.deskEyebrow, { color: color.ink }]}>Remaining budget</Text>
            <Text style={[styles.figure, { color: color.ink }]}>{money(desk.ledgerBase, decimals, symbol)}</Text>
          </View>
          <View style={[styles.numberCell, { borderLeftWidth: 1, borderLeftColor: t.ink(0.06) }]}>
            <Text style={[ST.deskEyebrow, { color: color.ink }]}>Your trade limit</Text>
            <Text style={[styles.limits, { color: color.ink }]}>{money(desk.grant.caps.maxStakePerTradeBase, decimals, symbol)}</Text>
            <Text style={[ST.deskFine, { color: color.ink }]}>
              {desk.grant.openPositions}/{desk.grant.caps.maxOpenPositions} open positions
            </Text>
          </View>
        </View>
      ) : null}
      <PrimaryButton label={`${desk.subscriptionOf(card.strategyId) ? "Manage this copy" : "Review and copy"} →`} onPress={onManage} style={styles.mt20} />
      <Text style={[ST.deskNote, styles.mt12, { color: color.inkMuted }]}>
        Copying enabled means permission is in place. Each trade still needs a market signal, fresh risk checks, and a confirmed receipt.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  desk: { borderRadius: 12, borderWidth: 1, overflow: "hidden", padding: 24, marginTop: 24, marginBottom: 24 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 16 },
  headText: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONT.headingHeavy, fontSize: 25.5, lineHeight: 25.5, letterSpacing: -0.6375 },
  what: { fontFamily: FONT.body, fontSize: 13.5, lineHeight: 18.5625, marginTop: 8 },
  mt24: { marginTop: 24 },
  mt20: { marginTop: 20 },
  mt12: { marginTop: 12 },
  pulse: { marginTop: 20, paddingLeft: 12, paddingVertical: 2 },
  numbers: { flexDirection: "row", borderWidth: 1, marginTop: 20 },
  numberCell: { flex: 1, padding: 12 },
  figure: { fontFamily: FONT.headingHeavy, fontSize: 24, lineHeight: 24, fontVariant: ["tabular-nums"] },
  limits: { fontFamily: FONT.dataRegular, fontSize: 14, lineHeight: 22.4, fontVariant: ["tabular-nums"] },
});
