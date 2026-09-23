import { parseStrategyMetadata, type StrategySubscription } from "@agari/core/strategies";
import { StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { money } from "@/features/strategies/format";
import { strategyIdentity } from "@/features/strategies/identity";
import type { StrategyWire } from "@/features/strategies/protocol";
import { Card, Pill } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { AgentPortrait } from "./AgentPortrait";
import { EquityChart } from "./EquityChart";

export type TierKey = "new" | "active" | "settled";

/** web's tierOf: "Settled" means closed on-chain P&L (a win or a loss) — never profit; a copied agent is not "new". */
export function tierOf(card: StrategyWire): { key: TierKey; label: string } {
  if (card.record.settled > 0) return { key: "settled", label: STRATEGIES.tiers.settled(card.record.settled) };
  if (card.record.fills >= 1) return { key: "active", label: STRATEGIES.tiers.active(card.record.fills) };
  if (card.subscribers > 0) return { key: "new", label: STRATEGIES.tiers.copying(card.subscribers) };
  return { key: "new", label: STRATEGIES.tiers.fresh };
}

// 21st: arihantcodes/insight-cards — label, one bold mono figure, a spark under it, a quiet note line.
/**
 * web's features/strategies/StrategyCard.tsx: who, the one bold move (net and its curve once anything settled),
 * status tags, a quiet spec line and the call to review. The whole card is one touch target.
 */
export function StrategyCard({ card, sub, decimals, symbol, asset, onOpen }: {
  card: StrategyWire;
  sub: StrategySubscription | null;
  decimals: number;
  symbol: string;
  asset: string;
  onOpen: () => void;
}) {
  const { color } = useTheme();
  const { name, seed } = strategyIdentity(card);
  const net = BigInt(card.record.netBase);
  const fee = BigInt(card.feeBase);
  const cap = money(BigInt(card.envelope.maxStakePerTradeBase), decimals);
  const spec = parseStrategyMetadata(card.metadata)?.spec ?? null;
  const instinct = spec?.preset === "agent"
    ? STRATEGIES.archive.agentInstinct(asset, spec.posture)
    : STRATEGIES.archive.instinct(asset, spec?.preset === "reversion" ? "reversion" : "momentum");
  const memory = Boolean(card.agent && card.agent.decisions.length > 0);
  const copiers = card.subscribers > 0 ? ` · ${card.subscribers} copiers` : "";
  const foot = STRATEGIES.archive.foot(cap, fee === 0n ? STRATEGIES.archive.free : `${money(fee, decimals)} fee`, copiers);

  return (
    <Card onPress={onOpen} accessibilityLabel={`${name}. ${sub ? "Manage copy" : "Review strategy"}`}>
      <View style={styles.head}>
        <AgentPortrait seed={seed} name={name} />
        <View style={styles.who}>
          <Text style={[TYPE.title, { color: color.ink }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[TYPE.data, styles.instinct, { color: color.inkMuted }]} numberOfLines={2}>
            {instinct}
          </Text>
        </View>
        <Text style={[TYPE.data, { color: color.ink }]}>
          {cap} <Text style={{ color: color.inkMuted }}>{STRATEGIES.archive.max}</Text>
        </Text>
      </View>

      {card.record.settled > 0 ? (
        <View style={styles.move}>
          <View style={styles.net}>
            <Text style={[TYPE.dataLg, { color: net >= 0n ? color.accent : color.inkSecondary }]}>
              {net >= 0n ? "+" : "−"}
              {money(net < 0n ? -net : net, decimals)}
            </Text>
            <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>
              <Text style={styles.keepCase}>{symbol}</Text> {STRATEGIES.archive.netMeta(card.record.settled)}
            </Text>
          </View>
          {card.record.curve.length >= 2 ? <EquityChart curve={card.record.curve} decimals={decimals} symbol={symbol} height={48} /> : null}
        </View>
      ) : (
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{tierOf(card).label}</Text>
      )}

      <View style={styles.tags}>
        <Pill label={card.active ? "Published" : "Inactive"} tone={card.active ? "neutral" : "warning"} dot />
        {memory ? <Pill label={STRATEGIES.archive.memory.replace("◈ ", "")} tone="accent" /> : null}
        {card.playbook ? <Pill label={STRATEGIES.archive.playbook.replace("▤ ", "")} tone="accent" /> : null}
      </View>

      <View style={[styles.foot, { borderTopColor: color.hairline }]}>
        <Text style={[TYPE.caption, styles.footText, { color: color.inkMuted }]} numberOfLines={1}>
          {foot}
        </Text>
        <View style={styles.cta}>
          {sub?.live ? <View style={[styles.live, { backgroundColor: color.accent }]} /> : null}
          <Text style={[TYPE.labelMicro, { color: sub ? color.accent : color.inkSecondary }]}>
            {sub ? "Manage copy" : STRATEGIES.archive.copy} →
          </Text>
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  who: { flex: 1, gap: 4, minWidth: 0 },
  instinct: { fontSize: 11.5, lineHeight: 15 },
  move: { gap: 8 },
  net: { flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 8 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  foot: { flexDirection: "row", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10 },
  footText: { flex: 1 },
  cta: { flexDirection: "row", alignItems: "center", gap: 6 },
  live: { width: 6, height: 6, borderRadius: 3 },
  keepCase: { textTransform: "none" },
});
