import { parseStrategyMetadata, type StrategySubscription } from "@agari/core/strategies";
import type { Address } from "@agari/core/types";
import { addressUrl } from "@agari/core/urls";
import type { VaultGrant } from "@agari/core/vault";
import { BlurView } from "expo-blur";
import { X } from "lucide-react-native";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn, SlideInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { STRATEGIES } from "@/features/strategies/copy";
import { strategyIdentity } from "@/features/strategies/identity";
import type { StrategyWire } from "@/features/strategies/protocol";
import { useStrategyHealth } from "@/features/strategies/useStrategies";
import { openExternal } from "~/lib/external";
import { FONT } from "~/theme";
import { AgentMemory } from "./AgentMemory";
import { AgentPortrait } from "./AgentPortrait";
import { CopyPanel } from "./CopyPanel";
import { RecordCard } from "./RecordCard";
import { ST, useStrat } from "./ui";
import { useCopySetup, type DeskWrites } from "./useCopySetup";

type DrawerTab = "copy" | "decisions" | "playbook";
const T = STRATEGIES.drawer.tabs;

interface CopyDrawerProps {
  card: StrategyWire; sub: StrategySubscription | null; grant: VaultGrant | null; readable: boolean;
  writes: DeskWrites; availableBase: bigint; decimals: number; symbol: string;
  asset: string; nowMs: number; decisionsStore: boolean; onClose: () => void;
}

/**
 * web's features/strategies/CopyDrawer.tsx: strategies.css `.strat-drawer` sliding in from the right over the blurred
 * scrim (a full-width sheet at phone width) — who, the description, the record, then the Copy / Decisions / Playbook
 * tabs. An agent's decisions open first for someone not yet copying it.
 */
export function CopyDrawer({ card, sub, grant, readable, writes, availableBase, decimals, symbol, asset, nowMs, decisionsStore, onClose }: CopyDrawerProps) {
  const { t, color } = useStrat();
  const insets = useSafeAreaInsets();
  const setup = useCopySetup({ card, sub, grant, readable, writes, availableBase, decimals, symbol, nowMs });
  const heartbeat = useStrategyHealth([card.strategyId]);
  const health = heartbeat?.ok && !heartbeat.stale && heartbeat.value.reachable ? heartbeat.value.strategies[card.strategyId] ?? null : null;
  const { name, seed } = strategyIdentity(card);
  const meta = parseStrategyMetadata(card.metadata);
  const playbook = card.playbook ?? meta?.playbook ?? null;
  const tabs: DrawerTab[] = ["copy", ...(card.agent ? ["decisions" as const] : []), ...(playbook ? ["playbook" as const] : [])];
  const [tab, setTab] = useState<DrawerTab>(() => (card.agent && !sub && !setup.pending ? "decisions" : "copy"));
  const body = [ST.drawerBody, { color: t.ink(0.7) }];

  return (
    <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Animated.View entering={FadeIn.duration(220)} style={StyleSheet.absoluteFill}>
          <BlurView intensity={12} style={StyleSheet.absoluteFill} />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: t.scrim }]} />
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close strategy" />
        </Animated.View>
        <Animated.View entering={SlideInRight.duration(220)} style={[styles.drawer, { backgroundColor: color.ground, borderLeftColor: t.ink(0.1), boxShadow: t.drawerShadow }]} accessibilityViewIsModal>
          <ScrollView contentContainerStyle={[styles.content, { paddingTop: 24 + insets.top, paddingBottom: 24 + insets.bottom }]} keyboardShouldPersistTaps="handled">
            <View style={styles.head}>
              <AgentPortrait seed={seed} name={name} />
              <View style={styles.headText}>
                <Text numberOfLines={1} style={[styles.name, { color: color.ink }]} accessibilityRole="header">
                  {name}
                </Text>
                <Pressable accessibilityRole="link" onPress={() => void openExternal(addressUrl(card.runner as Address))}>
                  <Text style={[ST.meta, { color: color.inkMuted }]}>Runner on Solana ↗</Text>
                </Pressable>
              </View>
            </View>
            <Text style={[body, styles.mb20]}>
              {meta?.description || "A published strategy with enforced trading limits."} Markets: {asset}.
            </Text>
            <RecordCard record={card.record} decimals={decimals} symbol={symbol} />
            {tabs.length > 1 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsWrap} contentContainerStyle={styles.tabs} accessibilityRole="tablist">
                {tabs.map((key) => {
                  const on = tab === key;
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="tab"
                      accessibilityState={{ selected: on }}
                      onPress={() => setTab(key)}
                      style={[styles.tab, on ? { borderColor: t.vermilion, backgroundColor: t.vermilionA(0.07) } : { borderColor: color.hairline }]}
                    >
                      <Text style={[styles.tabText, { color: on ? color.ink : color.inkSecondary }]}>
                        {key === "decisions" ? `${T.decisions} · ${card.agent?.decisions.length ?? 0}` : key === "playbook" ? T.playbook : sub ? T.manage : T.copy}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            ) : null}
            {tab === "copy" ? (
              <CopyPanel card={card} sub={sub} grant={grant} setup={setup} writes={writes} availableBase={availableBase} decimals={decimals} symbol={symbol} nowMs={nowMs} health={health} />
            ) : null}
            {tab === "decisions" && card.agent ? (
              <View style={styles.mt20}>
                <AgentMemory agent={card.agent} agentName={name} storeConnected={decisionsStore} decimals={decimals} symbol={symbol} nowMs={nowMs} />
              </View>
            ) : null}
            {tab === "playbook" && playbook ? (
              <Text selectable style={[body, styles.mt20]}>
                {playbook}
              </Text>
            ) : null}
          </ScrollView>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close strategy" hitSlop={6} style={[styles.close, { top: 16 + insets.top }]}>
            <X size={16} color={color.inkDisabled} />
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: "row", justifyContent: "flex-end" },
  drawer: { height: "100%", width: "100%", maxWidth: 440, borderLeftWidth: 1 },
  content: { paddingHorizontal: 24 },
  close: { position: "absolute", right: 16, padding: 8, borderRadius: 9999 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingRight: 32, marginBottom: 20 },
  headText: { flex: 1, minWidth: 0 },
  name: { fontFamily: FONT.headingHeavy, fontSize: 20, lineHeight: 32 },
  mb20: { marginBottom: 20 },
  mt20: { marginTop: 20 },
  tabsWrap: { marginTop: 20, flexGrow: 0 },
  tabs: { gap: 6 },
  tab: { borderWidth: 1, borderRadius: 6, paddingVertical: 8.25, paddingHorizontal: 12 },
  tabText: { fontFamily: FONT.dataRegular, fontSize: 10.5, lineHeight: 16.8 },
});
