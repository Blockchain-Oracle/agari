import { parseStrategyMetadata } from "@agari/core/strategies";
import { StyleSheet, Text, View } from "react-native";
import { money } from "@/features/strategies/format";
import { strategyIdentity, STRATEGY_MARKETS } from "@/features/strategies/identity";
import { COPY_STATE_LABEL } from "@/features/strategies/lifecycle";
import type { StrategiesPayload } from "@/features/strategies/protocol";
import type { DeskModel } from "@/features/strategies/useDesk";
import { Button, Card, Row, Rows } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { AgentPortrait } from "./AgentPortrait";
import { RecordCard } from "./RecordCard";
import { StrategyActivity } from "./StrategyActivity";

/** web's features/strategies/LiveDesk.tsx: the selected strategy, its real consent state and the runner's own report. */
export function LiveDesk({ payload, desk, nowMs, onManage }: {
  payload: StrategiesPayload;
  desk: DeskModel;
  nowMs: number;
  onManage: () => void;
}) {
  const { color } = useTheme();
  const card = desk.featured;
  if (!card) return null;
  const { name, seed } = strategyIdentity(card);
  const { decimals, symbol } = payload;
  const health = desk.health?.ok && !desk.health.stale && desk.health.value.reachable ? desk.health.value.strategies[card.strategyId] ?? null : null;
  const spec = parseStrategyMetadata(card.metadata)?.spec;
  const kind = spec?.preset === "agent" ? "AI judgment with enforced limits" : spec?.preset === "reversion" ? "Opening-price reversion rule" : "Opening-price momentum rule";
  return (
    <Card accessibilityLabel="Selected strategy">
      <View style={styles.head}>
        <AgentPortrait seed={seed} name={name} />
        <View style={styles.who}>
          <Text style={[TYPE.title, { color: color.ink }]}>{name}</Text>
          <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
            {kind} · {STRATEGY_MARKETS}
          </Text>
        </View>
      </View>
      <RecordCard record={card.record} decimals={decimals} symbol={symbol} />
      <Text style={[TYPE.labelMicro, { color: color.accent }]}>{COPY_STATE_LABEL[desk.state]}</Text>
      <StrategyActivity state={desk.state} grant={desk.grant} health={health} nowMs={nowMs} />
      {desk.grant ? (
        <Rows>
          <Row label="Remaining budget" value={money(desk.ledgerBase, decimals, symbol)} strong />
          <Row label="Your trade limit" value={money(desk.grant.caps.maxStakePerTradeBase, decimals, symbol)} />
          <Row label="Open positions" value={`${desk.grant.openPositions}/${desk.grant.caps.maxOpenPositions}`} />
        </Rows>
      ) : null}
      <Button label={`${desk.subscriptionOf(card.strategyId) ? "Manage this copy" : "Review and copy"}`} trailing="→" onPress={onManage} />
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        Copying enabled means permission is in place. Each trade still needs a market signal, fresh risk checks, and a confirmed receipt.
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  who: { flex: 1, gap: 2 },
});
