import { addressUrl } from "@agari/core/urls";
import type { Address } from "@agari/core/types";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { AGENTS } from "@/features/strategies/copy";
import { money } from "@/features/strategies/format";
import { strategyIdentity } from "@/features/strategies/identity";
import { ago, shortAddress } from "@/features/strategies/names";
import type { StrategiesPayload } from "@/features/strategies/protocol";
import { AgentPortrait } from "~/features/strategies/AgentPortrait";
import { ST, useStrat } from "~/features/strategies/ui";
import { openExternal } from "~/lib/external";
import { FONT } from "~/theme";
import { rankRunners } from "./ranking";

/** web AgentsScreen `Stat`: the bordered tile, mono label, Sora figure, an optional quiet line. */
function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  const { t, color } = useStrat();
  return (
    <View style={[styles.stat, { backgroundColor: color.ground, borderColor: t.ink(0.08) }]}>
      <Text style={[ST.meta, styles.statLabel, { color: color.inkMuted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: color.ink }]}>{value}</Text>
      {sub ? <Text style={[ST.mono11, styles.statSub, { color: color.inkDisabled }]}>{sub}</Text> : null}
    </View>
  );
}

/** The numbered section head AgentsScreen draws itself: vermilion index, Sora title, optional meta, a hairline. */
function Head({ index, title, meta }: { index: string; title: string; meta?: string }) {
  const { color } = useStrat();
  return (
    <View style={[styles.head, { borderBottomColor: color.hairline }]}>
      <Text style={[ST.mono11, { color: color.accent }]}>{index}</Text>
      <Text style={[ST.h2, { color: color.ink }]} accessibilityRole="header">
        {title}
      </Text>
      {meta ? <Text style={[ST.meta, styles.headMeta, { color: color.inkMuted }]}>{meta}</Text> : null}
    </View>
  );
}

function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  const { color } = useStrat();
  return (
    <View style={styles.cell}>
      <Text style={[styles.label, { color: color.inkMuted }]}>{label}</Text>
      {children}
    </View>
  );
}

/** web AgentsScreen `Board`: four stat tiles, the ranked runners, and how the ranking works. */
export function AgentsBoard({ payload }: { payload: StrategiesPayload }) {
  const { t, color } = useStrat();
  const nowMs = useChainNowMs();
  const { strategies, decimals, symbol } = payload;
  const rows = useMemo(() => rankRunners(strategies), [strategies]);
  const totalVolume = rows.reduce((s, r) => s + r.capitalEntrustedBase, 0n);
  const totalSubscribers = strategies.reduce((s, c) => s + c.subscribers, 0);
  const panel = { backgroundColor: color.ground, borderColor: t.ink(0.08) };

  return (
    <View style={styles.board}>
      <View style={styles.grid}>
        <Stat label={AGENTS.stats.agents} value={String(rows.length)} />
        <Stat label={AGENTS.stats.strategies} value={String(strategies.length)} />
        <Stat label={AGENTS.stats.subscribers} value={String(totalSubscribers)} sub={AGENTS.stats.subscribersSub} />
        <Stat label={AGENTS.stats.volume} value={money(totalVolume, decimals)} sub={AGENTS.stats.volumeSub} />
      </View>

      <View>
        <Head index={AGENTS.desk.index} title={AGENTS.desk.title} meta={AGENTS.desk.meta(rows.length)} />
        {rows.length === 0 ? (
          <View style={[styles.panel, styles.emptyPanel, panel]}>
            <Text style={[ST.h2, styles.center, { color: color.ink, marginBottom: 8 }]}>{AGENTS.empty.title}</Text>
            <Text style={[ST.textSm, styles.center, { color: color.inkMuted }]}>{AGENTS.empty.body}</Text>
          </View>
        ) : (
          <View style={styles.rows}>
            {rows.map((row, i) => {
              const rank = i + 1;
              const top = rank === 1;
              const editions = strategies.filter((card) => card.runner === row.runner);
              const identity = editions.length === 1 ? strategyIdentity(editions[0]!) : { name: `Runner ${shortAddress(row.runner)}`, seed: `runner:${row.runner}` };
              return (
                <View key={row.runner} style={[styles.row, panel, top && { borderLeftWidth: 2, borderLeftColor: t.vermilion }]}>
                  <Text style={[styles.rank, { color: t.gray700 }]}>{String(rank).padStart(2, "0")}</Text>
                  <View style={styles.who}>
                    <AgentPortrait seed={identity.seed} name={identity.name} size="row" />
                    <View style={styles.whoText}>
                      <View style={styles.nameLine}>
                        <Pressable onPress={() => void openExternal(addressUrl(row.runner as Address))} accessibilityRole="link" style={styles.shrink}>
                          <Text numberOfLines={1} style={[ST.mono12, { color: color.ink }]}>
                            {identity.name}
                          </Text>
                        </Pressable>
                        {top ? (
                          <Text style={[styles.badge, { color: t.vermilion, borderColor: t.vermilionD }]}>{AGENTS.desk.top}</Text>
                        ) : null}
                      </View>
                      <Text numberOfLines={1} style={[ST.mono11, styles.mt4, { color: color.inkDisabled }]}>
                        {AGENTS.desk.strategies(row.strategies)} · {AGENTS.desk.subscribers(row.subscribers)}
                      </Text>
                      <View style={styles.editions}>
                        {editions.map((card) => (
                          <Pressable
                            key={card.strategyId}
                            accessibilityRole="link"
                            onPress={() => router.push({ pathname: "/strategies", params: { view: "copy", strategy: card.strategyId } })}
                          >
                            <Text style={[ST.mono11, { color: color.accent }]}>{strategyIdentity(card).name} →</Text>
                          </Pressable>
                        ))}
                      </View>
                    </View>
                  </View>
                  <View style={styles.figures}>
                    <Figure label={AGENTS.desk.entrusted}>
                      <Text style={[styles.figure, { color: t.vermilion }]}>
                        {money(row.capitalEntrustedBase, decimals)}
                        <Text style={[ST.mono11, { color: color.inkMuted, fontWeight: "normal" }]}> {symbol}</Text>
                      </Text>
                    </Figure>
                    <Figure label={AGENTS.desk.copyTrades}>
                      <Text style={[styles.figure, { color: color.ink }]}>{row.copyTrades}</Text>
                    </Figure>
                    <Figure label={AGENTS.desk.maxPerTrade}>
                      <Text style={[styles.figure, { color: color.ink }]}>{money(row.maxStakePerTradeBase, decimals)}</Text>
                    </Figure>
                    <Figure label={AGENTS.desk.lastActive}>
                      <Text style={[ST.mono12, { color: color.inkSecondary }]}>{ago(row.lastActiveSec * 1000, nowMs)}</Text>
                    </Figure>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </View>

      <View>
        <Head index={AGENTS.how.index} title={AGENTS.how.title} />
        <View style={[styles.panel, panel, styles.rules]}>
          {AGENTS.how.rules.map((rule, i) => (
            <View key={rule.join("")} style={styles.rule}>
              <Text style={[ST.mono11, styles.ruleIndex, { color: color.accent }]}>{String(i + 1).padStart(2, "0")}</Text>
              <Text style={[ST.textSmRelaxed, styles.ruleText, { color: color.inkSecondary }]}>
                {rule.map((part, j) => (
                  <Text key={`${part}${j}`} style={j % 2 === 1 ? { color: color.ink } : undefined}>
                    {part}
                  </Text>
                ))}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  board: { gap: 32 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  stat: { width: "48.3%", flexGrow: 1, borderWidth: 1, borderRadius: 4, padding: 20 },
  statLabel: { marginBottom: 8, letterSpacing: 2 },
  statValue: { fontFamily: FONT.headingHeavy, fontSize: 30, lineHeight: 48, letterSpacing: -0.75, fontVariant: ["tabular-nums"] },
  statSub: { marginTop: 4 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingBottom: 8, marginBottom: 16, borderBottomWidth: 1 },
  headMeta: { marginLeft: "auto" },
  panel: { borderWidth: 1, borderRadius: 4, padding: 20 },
  emptyPanel: { padding: 64 },
  center: { textAlign: "center" },
  rows: { gap: 8 },
  row: { borderWidth: 1, borderRadius: 4, padding: 20, gap: 16 },
  rank: { fontFamily: FONT.dataStrong, fontSize: 30, lineHeight: 30, width: 48, fontVariant: ["tabular-nums"] },
  who: { flexDirection: "row", alignItems: "center", gap: 16 },
  whoText: { flex: 1, minWidth: 0 },
  nameLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  shrink: { flexShrink: 1 },
  badge: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.8, textTransform: "uppercase", paddingVertical: 2, paddingHorizontal: 6, borderRadius: 4, borderWidth: 1, flexShrink: 0 },
  mt4: { marginTop: 4 },
  editions: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 12, marginTop: 8 },
  figures: { flexDirection: "row", flexWrap: "wrap", gap: 16 },
  cell: { width: "46%", flexGrow: 1 },
  label: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.44, textTransform: "uppercase", marginBottom: 4 },
  figure: { fontFamily: FONT.dataStrong, fontSize: 18, lineHeight: 28.8, fontVariant: ["tabular-nums"] },
  rules: { gap: 12 },
  rule: { flexDirection: "row", gap: 12 },
  ruleIndex: { marginTop: 2, lineHeight: 17.875 },
  ruleText: { flex: 1 },
});
