import type { StrategySubscription } from "@agari/core/strategies";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { STRATEGIES } from "@/features/strategies/copy";
import type { StrategyWire } from "@/features/strategies/protocol";
import { FONT } from "~/theme";
import { Sticky } from "./StickyPage";
import { StrategyCard, tierOf } from "./StrategyCard";
import { ST, useStrat } from "./ui";

const TABS = ["all", "settled", "memwal", "copied", "safest", "new"] as const;
type TabKey = (typeof TABS)[number];

/** web StrategyGrid `filterSort`, unchanged. */
function filterSort(list: StrategyWire[], tab: TabKey): StrategyWire[] {
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

/**
 * web's features/strategies/StrategyGrid.tsx: "Published strategies" with its show/hide toggle, the sticky tab bar that
 * hides its zero counts, then the cards — or the empty archive panel.
 */
export function StrategyGrid({ strategies, subscriptionOf, decimals, symbol, asset, onOpen }: {
  strategies: StrategyWire[];
  subscriptionOf: (id: string) => StrategySubscription | null;
  decimals: number;
  symbol: string;
  asset: string;
  onOpen: (card: StrategyWire) => void;
}) {
  const { t, color } = useStrat();
  const [show, setShow] = useState(true);
  const [tab, setTab] = useState<TabKey>("all");
  const visible = useMemo(() => filterSort(strategies, tab), [strategies, tab]);
  const count = (k: TabKey) => filterSort(strategies, k).length;
  return (
    <>
      <View style={[styles.header, { borderTopColor: color.hairline }]}>
        <View style={styles.headerText}>
          <Text style={[ST.h2, { color: color.ink }]}>{STRATEGIES.archive.title}</Text>
          <Text style={[ST.meta, styles.mt4, { color: t.ink(0.35) }]}>{STRATEGIES.archive.editions(strategies.length)}</Text>
        </View>
        <Pressable onPress={() => setShow((v) => !v)} accessibilityRole="button" accessibilityState={{ expanded: show }} style={[styles.toggle, { borderColor: t.ink(0.12) }]}>
          <Text style={[ST.meta, { color: t.ink(0.65) }]}>{show ? STRATEGIES.archive.hide : STRATEGIES.archive.show(strategies.length)}</Text>
        </Pressable>
      </View>

      {show ? (
        <Sticky style={[styles.bar, { backgroundColor: t.stickyBg, borderBottomColor: color.hairline }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
            {TABS.filter((k) => k === "all" || count(k) > 0).map((k) => (
              <Pressable
                key={k}
                onPress={() => setTab(k)}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === k }}
                style={[styles.tab, { borderBottomColor: tab === k ? t.vermilion : "transparent" }]}
              >
                <Text style={[styles.tabText, { color: tab === k ? color.ink : t.ink(0.4) }]}>
                  {STRATEGIES.tabs[k]}
                  <Text style={{ color: tab === k ? t.ink(0.3) : t.ink(0.2) }}>{`  ${count(k)}`}</Text>
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Sticky>
      ) : null}

      {show ? (
        visible.length === 0 ? (
          <View style={[styles.empty, { borderColor: t.ink(0.08), backgroundColor: t.ink(0.02) }]}>
            <Text style={[ST.rail, styles.center, styles.mb16, { color: t.ink(0.4) }]}>
              <Text style={{ color: color.accent }}>⊙</Text> {STRATEGIES.archive.ledger}
            </Text>
            <Text style={[ST.h2, styles.center, styles.mb8, { color: color.ink }]}>
              {strategies.length === 0 ? STRATEGIES.archive.noneTitle : STRATEGIES.archive.noTab(STRATEGIES.tabs[tab])}
            </Text>
            <Text style={[ST.textSmRelaxed, styles.center, { color: t.ink(0.4) }]}>
              {strategies.length === 0 ? STRATEGIES.archive.noneBody : STRATEGIES.archive.noMatch}
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {visible.map((card) => (
              <StrategyCard key={card.strategyId} card={card} sub={subscriptionOf(card.strategyId)} decimals={decimals} symbol={symbol} asset={asset} onOpen={() => onOpen(card)} />
            ))}
          </View>
        )
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 48, paddingTop: 24, borderTopWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 16 },
  headerText: { flexShrink: 1 },
  mt4: { marginTop: 4 },
  toggle: { flexShrink: 0, borderRadius: 9999, borderWidth: 1, paddingVertical: 8, paddingHorizontal: 16 },
  bar: { marginTop: 20, marginBottom: 28, marginHorizontal: -16, paddingVertical: 12, borderBottomWidth: 1 },
  tabs: { gap: 20, paddingHorizontal: 16, alignItems: "center" },
  tab: { paddingHorizontal: 4, paddingBottom: 8, borderBottomWidth: 2 },
  tabText: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.32, textTransform: "uppercase" },
  empty: { borderWidth: 1, padding: 64 },
  center: { textAlign: "center" },
  mb16: { marginBottom: 16 },
  mb8: { marginBottom: 8 },
  grid: { gap: 16 },
});
