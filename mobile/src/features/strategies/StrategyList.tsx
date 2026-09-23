import type { StrategySubscription } from "@agari/core/strategies";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import type { StrategyWire } from "@/features/strategies/protocol";
import { EmptyState, haptic, SectionHeader } from "~/components/kit";
import { RADIUS, TYPE, useTheme } from "~/theme";
import { StrategyCard, tierOf } from "./StrategyCard";

const TABS = ["all", "settled", "memwal", "copied", "safest", "new"] as const;
type TabKey = (typeof TABS)[number];

/** web's StrategyGrid filterSort, unchanged: filters first, then the tab's order. */
function filterSort(list: readonly StrategyWire[], tab: TabKey): StrategyWire[] {
  let out = [...list];
  if (tab === "settled") out = out.filter((c) => tierOf(c).key === "settled");
  else if (tab === "new") out = out.filter((c) => tierOf(c).key === "new");
  else if (tab === "memwal") out = out.filter((c) => Boolean(c.playbook));
  const settledFirst = (a: StrategyWire, b: StrategyWire) => (tierOf(b).key === "settled" ? 1 : 0) - (tierOf(a).key === "settled" ? 1 : 0);
  if (tab === "copied") out.sort((a, b) => b.subscribers - a.subscribers || b.record.fills - a.record.fills);
  else if (tab === "safest") out.sort((a, b) => Number(BigInt(a.envelope.maxStakePerTradeBase) - BigInt(b.envelope.maxStakePerTradeBase)));
  else out.sort((a, b) => settledFirst(a, b) || b.record.fills - a.record.fills || b.subscribers - a.subscribers);
  return out;
}

/** web's features/strategies/StrategyGrid.tsx: published strategies with filter tabs that hide their zero counts. */
export function StrategyList({ strategies, subscriptionOf, decimals, symbol, asset, onOpen }: {
  strategies: readonly StrategyWire[];
  subscriptionOf: (id: string) => StrategySubscription | null;
  decimals: number;
  symbol: string;
  asset: string;
  onOpen: (card: StrategyWire) => void;
}) {
  const { color } = useTheme();
  const [tab, setTab] = useState<TabKey>("all");
  const visible = useMemo(() => filterSort(strategies, tab), [strategies, tab]);
  const tabs = TABS.map((key) => ({ key, count: filterSort(strategies, key).length })).filter((t) => t.key === "all" || t.count > 0);

  return (
    <View style={styles.wrap}>
      <SectionHeader title={STRATEGIES.archive.title} aside={STRATEGIES.archive.editions(strategies.length)} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
        {tabs.map(({ key, count }) => {
          const on = key === tab;
          return (
            <Pressable
              key={key}
              onPress={() => {
                haptic.select();
                setTab(key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${STRATEGIES.tabs[key]}, ${count}`}
              style={[styles.tab, { borderColor: on ? color.accent : color.hairline, backgroundColor: on ? color.accentWash : color.surface1 }]}
            >
              <Text style={[TYPE.bodyStrong, styles.tabText, { color: on ? color.ink : color.inkSecondary }]}>
                {STRATEGIES.tabs[key]} <Text style={[TYPE.data, { color: on ? color.accent : color.inkMuted }]}>{count}</Text>
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      {visible.length === 0 ? (
        <EmptyState
          why={strategies.length === 0 ? STRATEGIES.archive.noneTitle : STRATEGIES.archive.noTab(STRATEGIES.tabs[tab])}
          detail={strategies.length === 0 ? STRATEGIES.archive.noneBody : STRATEGIES.archive.noMatch}
        />
      ) : (
        visible.map((card) => (
          <StrategyCard
            key={card.strategyId}
            card={card}
            sub={subscriptionOf(card.strategyId)}
            decimals={decimals}
            symbol={symbol}
            asset={asset}
            onOpen={() => onOpen(card)}
          />
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  tabs: { gap: 8, paddingVertical: 2 },
  tab: { minHeight: 40, paddingHorizontal: 14, borderRadius: RADIUS.full, borderWidth: 1, justifyContent: "center" },
  tabText: { fontSize: 13.5 },
});
