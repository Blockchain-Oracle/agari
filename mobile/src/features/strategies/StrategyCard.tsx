import { parseStrategyMetadata, type StrategySubscription } from "@agari/core/strategies";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import { money } from "@/features/strategies/format";
import { strategyIdentity } from "@/features/strategies/identity";
import type { StrategyWire } from "@/features/strategies/protocol";
import { FONT } from "~/theme";
import { AgentPortrait } from "./AgentPortrait";
import { curvePoints, EquitySparkline } from "./EquitySparkline";
import { ST, useStrat } from "./ui";

export type Tier = { key: "new" | "active" | "settled"; label: string };

/** web StrategyCard `tierOf`: "Settled" means closed on-chain P&L (win or loss), never profit; a copied agent is not "new". */
export function tierOf(c: StrategyWire): Tier {
  if (c.record.settled > 0) return { key: "settled", label: STRATEGIES.tiers.settled(c.record.settled) };
  if (c.record.fills >= 1) return { key: "active", label: STRATEGIES.tiers.active(c.record.fills) };
  if (c.subscribers > 0) return { key: "new", label: STRATEGIES.tiers.copying(c.subscribers) };
  return { key: "new", label: STRATEGIES.tiers.fresh };
}

/**
 * web's features/strategies/StrategyCard.tsx (part-17 `.strat-card`): who, the one bold move — the settled net and its
 * curve, or the honest tier — the Published and memory tags, the quiet spec line and the borderless CTA.
 */
export function StrategyCard({ card, sub, decimals, symbol, asset, onOpen }: {
  card: StrategyWire;
  sub: StrategySubscription | null;
  decimals: number;
  symbol: string;
  asset: string;
  onOpen: () => void;
}) {
  const { t, color } = useStrat();
  const { name, seed } = strategyIdentity(card);
  const settled = card.record.settled > 0;
  const net = BigInt(card.record.netBase);
  const fee = BigInt(card.feeBase);
  const copiers = card.subscribers > 0 ? ` · ${card.subscribers} copiers` : "";
  const spec = parseStrategyMetadata(card.metadata)?.spec ?? null;
  const instinct = spec?.preset === "agent" ? STRATEGIES.archive.agentInstinct(asset, spec.posture) : STRATEGIES.archive.instinct(asset, spec?.preset === "reversion" ? "reversion" : "momentum");
  const memory = Boolean(card.agent && card.agent.decisions.length > 0);
  const max = money(BigInt(card.envelope.maxStakePerTradeBase), decimals);
  const tag = [styles.tag, { backgroundColor: t.vermilionA(0.12) }];
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: t.cardBg, borderColor: t.cardBorder, boxShadow: t.cardShadow },
        pressed && { transform: [{ translateY: -1 }, { scale: 0.995 }] },
      ]}
    >
      <View style={styles.top}>
        <AgentPortrait seed={seed} name={name} />
        <View style={styles.who}>
          <Text numberOfLines={1} style={[styles.name, { color: color.ink }]}>
            {name}
          </Text>
          <Text style={[styles.instinct, { color: t.ink(0.45) }]}>{instinct}</Text>
        </View>
        <Text style={[ST.mono11, styles.cap, { color: t.ink(0.7), borderColor: t.ink(0.12) }]}>
          {max} <Text style={{ color: t.ink(0.4) }}>{STRATEGIES.archive.max}</Text>
        </Text>
      </View>

      <View style={styles.move}>
        {settled ? (
          <>
            <View style={styles.netLine}>
              <Text style={[styles.net, { color: net >= 0n ? color.profit : color.loss }]}>
                {net >= 0n ? "+" : "−"}
                {money(net < 0n ? -net : net, decimals)}
              </Text>
              <Text style={[ST.meta, { color: t.ink(0.4) }]}>
                <Text style={styles.keepCase}>{symbol}</Text> {STRATEGIES.archive.netMeta(card.record.settled)}
              </Text>
            </View>
            {card.record.curve.length >= 2 ? (
              <View style={styles.spark}>
                <EquitySparkline points={curvePoints(card.record.curve)} decimals={decimals} />
              </View>
            ) : null}
          </>
        ) : (
          <Text style={[ST.mono11, styles.tier, { color: t.ink(0.4) }]}>{tierOf(card).label}</Text>
        )}
      </View>

      <View style={styles.tags}>
        <View style={styles.quiet}>
          <View style={[styles.dot, { backgroundColor: t.ink(0.3) }]} />
          <Text style={[styles.tagText, { color: t.ink(0.35) }]}>{card.active ? "Published" : "Inactive"}</Text>
        </View>
        {memory ? (
          <View style={tag}>
            <Text style={[styles.tagText, { color: t.vermilion }]}>{STRATEGIES.archive.memory}</Text>
          </View>
        ) : null}
        {card.playbook ? (
          <View style={tag}>
            <Text style={[styles.tagText, { color: t.vermilion }]}>{STRATEGIES.archive.playbook}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.foot}>
        <Text numberOfLines={1} style={[ST.mono10, styles.footSpec, { color: t.ink(0.4) }]}>
          {STRATEGIES.archive.foot(max, fee === 0n ? STRATEGIES.archive.free : `${money(fee, decimals)} fee`, copiers)}
        </Text>
        <View style={styles.cta}>
          {sub?.live ? <View style={[styles.live, { backgroundColor: t.vermilion }]} /> : null}
          <Text style={[ST.mono11, styles.ctaText, { color: sub ? color.accent : t.ink(0.55) }]}>
            {sub ? "Manage copy" : STRATEGIES.archive.copy} →
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { padding: 24, borderRadius: 18, borderWidth: 1 },
  top: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  who: { flex: 1, minWidth: 0, paddingTop: 2 },
  name: { fontFamily: FONT.headingHeavy, fontSize: 19, lineHeight: 23.75, letterSpacing: -0.475 },
  instinct: { marginTop: 4, fontFamily: FONT.dataRegular, fontSize: 10.5, lineHeight: 16.8 },
  cap: { flexShrink: 0, marginTop: 2, borderWidth: 1, borderRadius: 9999, paddingVertical: 4, paddingHorizontal: 10, overflow: "hidden" },
  move: { marginTop: 24, minHeight: 42 },
  netLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", gap: 8 },
  net: { fontFamily: FONT.headingHeavy, fontSize: 30, lineHeight: 30, fontVariant: ["tabular-nums"] },
  keepCase: { textTransform: "none" },
  spark: { marginTop: 12, marginHorizontal: -4 },
  tier: { paddingTop: 10, textTransform: "uppercase", letterSpacing: 1.54 },
  tags: { marginTop: 16, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  quiet: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 4, height: 4, borderRadius: 9999 },
  tag: { borderRadius: 9999, paddingVertical: 4, paddingHorizontal: 10 },
  tagText: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.44, textTransform: "uppercase" },
  foot: { paddingTop: 24, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  footSpec: { flexShrink: 1 },
  cta: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  live: { width: 6, height: 6, borderRadius: 9999 },
  ctaText: { textTransform: "uppercase", letterSpacing: 1.32 },
});
