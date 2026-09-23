import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { AGENTS, STRATEGIES } from "@/features/strategies/copy";
import { money } from "@/features/strategies/format";
import { strategyIdentity } from "@/features/strategies/identity";
import type { StrategiesPayload } from "@/features/strategies/protocol";
import { useWalletSession } from "@/lib/wallet-session";
import { Card, EmptyState, Pill, SectionHeader } from "~/components/kit";
import { TYPE, useTheme } from "~/theme";
import { AgentPortrait } from "../strategies/AgentPortrait";
import { openStrategy } from "../strategies/Catalogue";
import { rankRunners } from "./ranking";
import { RunnerRow } from "./RunnerRow";
import { StatTiles } from "./StatTiles";

const HEALTH_TONE = { alive: "profit", stale: "loss", "never-started": "neutral", unknown: "warning" } as const;

/** web's AgentsScreen Board: the four totals, your own published agents, the ranked runners and how they are ranked. */
export function AgentsBoard({ payload }: { payload: StrategiesPayload }) {
  const { color } = useTheme();
  const nowMs = useChainNowMs();
  const { address } = useWalletSession();
  const { strategies, decimals, symbol } = payload;
  const rows = useMemo(() => rankRunners(strategies), [strategies]);
  const totalVolume = rows.reduce((s, r) => s + r.capitalEntrustedBase, 0n);
  const totalSubscribers = strategies.reduce((s, c) => s + c.subscribers, 0);
  const mine = address ? strategies.filter((s) => s.creator === address) : [];

  return (
    <View style={styles.wrap}>
      <StatTiles
        stats={[
          { label: AGENTS.stats.agents, value: String(rows.length) },
          { label: AGENTS.stats.strategies, value: String(strategies.length) },
          { label: AGENTS.stats.subscribers, value: String(totalSubscribers), sub: AGENTS.stats.subscribersSub },
          { label: AGENTS.stats.volume, value: money(totalVolume, decimals), sub: AGENTS.stats.volumeSub },
        ]}
      />

      {mine.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Your agents" aside={String(mine.length)} desc="Published from this wallet. Open one to see its runner report, record and copiers." />
          {mine.map((card) => {
            const { name, seed } = strategyIdentity(card);
            return (
              <Card key={card.strategyId} onPress={() => openStrategy(card)} accessibilityLabel={`${name}, manage`}>
                <View style={styles.mineHead}>
                  <AgentPortrait seed={seed} name={name} size="row" />
                  <View style={styles.flex}>
                    <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{name}</Text>
                    <Text style={[TYPE.caption, { color: color.inkMuted }]}>
                      #{card.strategyId} · {AGENTS.desk.subscribers(card.subscribers)} · {card.record.fills} copy-trades
                    </Text>
                  </View>
                </View>
                <View style={styles.pills}>
                  <Pill label={card.active ? "Published" : "Inactive"} tone={card.active ? "neutral" : "warning"} dot />
                  <Pill label={`Runner ${STRATEGIES.health[card.health.kind === "never-started" ? "neverStarted" : card.health.kind]}`} tone={HEALTH_TONE[card.health.kind]} dot />
                </View>
                {card.health.why ? (
                  <Text style={[TYPE.caption, { color: color.inkSecondary }]} numberOfLines={2}>
                    {card.health.why}
                  </Text>
                ) : null}
              </Card>
            );
          })}
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeader index={AGENTS.desk.index} title={AGENTS.desk.title} aside={AGENTS.desk.meta(rows.length)} />
        {rows.length === 0 ? (
          <EmptyState why={AGENTS.empty.title} detail={AGENTS.empty.body} />
        ) : (
          rows.map((row, i) => (
            <RunnerRow
              key={row.runner}
              row={row}
              rank={i + 1}
              editions={strategies.filter((card) => card.runner === row.runner)}
              decimals={decimals}
              symbol={symbol}
              nowMs={nowMs}
            />
          ))
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader index={AGENTS.how.index} title={AGENTS.how.title} />
        <Card>
          {AGENTS.how.rules.map((rule, i) => (
            <View key={rule.join("")} style={styles.rule}>
              <Text style={[TYPE.data, { color: color.accent }]}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={[TYPE.caption, styles.flex, { color: color.inkSecondary }]}>
                {rule.map((part, j) => (
                  <Text key={`${part}${j}`} style={j % 2 === 1 ? { color: color.ink } : undefined}>
                    {part}
                  </Text>
                ))}
              </Text>
            </View>
          ))}
        </Card>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 24 },
  section: { gap: 12 },
  mineHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  pills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  rule: { flexDirection: "row", gap: 10 },
});
