import { neededMove } from "@agari/core/market";
import type { Lane } from "@agari/core/types";
import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { assetPairUnit, assetPriceLine } from "@/features/markets/hero/units";
import { compareLaneTabKeys, laneTabKey, laneTabLabel, laneTabParts, type LaneTabKey } from "@/features/markets/lanes/lane-view";
import { HERO, HERO_HEAD } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { mkType, useMk } from "./mk";

/** `.hero-chart-head`: the reading on the left, the clock on the right. */
export function HeadShell({ children, clock }: { children: ReactNode; clock: ReactNode }) {
  return (
    <View style={styles.head}>
      <View style={styles.left}>{children}</View>
      {clock}
    </View>
  );
}

/** `.mh-asset-row`: the 28 px disc, the mono label, and the tabs that govern the headline. */
export function AssetRow({ asset, label, children }: { asset: string; label: string; children?: ReactNode }) {
  const mk = useMk();
  return (
    <View style={styles.assetRow}>
      <AssetDisc asset={asset} size={28} />
      <Text style={[mkType.assetLabel, { color: mk.ink }]}>{label}</Text>
      {children}
    </View>
  );
}

interface Tab {
  key: string;
  label: string;
  on: boolean;
  live: boolean;
  onPress: () => void;
}

/** `.mh-cadence-tabs`: type alone carries the state — idle at 35 %, a dead slot at 15 %, the one on screen vermilion and underlined. */
export function CadenceRow({ tabs, accessibilityLabel }: { tabs: readonly Tab[]; accessibilityLabel: string }) {
  const mk = useMk();
  return (
    <View style={styles.tabs} accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel}>
      {tabs.map((tab) => (
        <Pressable
          key={tab.key}
          disabled={!tab.live}
          onPress={() => {
            haptic.select();
            tab.onPress();
          }}
          accessibilityRole="radio"
          accessibilityState={{ selected: tab.on, disabled: !tab.live }}
          style={styles.tab}
        >
          <Text style={[mkType.cadence, { color: tab.on ? mk.vermilion : tab.live ? mk.cadence : mk.cadenceOff }]}>{tab.label}</Text>
          {tab.on ? <View style={[styles.underline, { backgroundColor: mk.vermilion }]} /> : null}
        </Pressable>
      ))}
    </View>
  );
}

/** web's HeroCadenceTabs: a slot per live (basis, cadence) lane, plus the pinned lane between rounds, in lane order. */
export function HeroCadenceTabs({ lanes, activeKey, pinnedMissingKey, onPin }: { lanes: readonly Lane[]; activeKey: LaneTabKey | null; pinnedMissingKey: LaneTabKey | null; onPin: (key: LaneTabKey) => void }) {
  const slots = lanes.map((lane) => ({ key: laneTabKey(lane.basis, lane.intervalSec), label: laneTabLabel(lane.basis, lane.intervalSec), live: lane.markets.length > 0 }));
  if (pinnedMissingKey !== null && !slots.some((slot) => slot.key === pinnedMissingKey)) {
    const { basis, intervalSec } = laneTabParts(pinnedMissingKey);
    slots.push({ key: pinnedMissingKey, label: laneTabLabel(basis, intervalSec), live: false });
  }
  slots.sort((a, b) => compareLaneTabKeys(a.key, b.key));
  return <CadenceRow accessibilityLabel={HERO_HEAD.cadenceGroup} tabs={slots.map((slot) => ({ ...slot, on: slot.key === activeKey, onPress: () => onPin(slot.key) }))} />;
}

/** web's HeroQuestion: the headline against the opening print (vermilion), then how far the live price sits from it, about UP. */
export function HeroQuestion({ asset, ask, openingRaw, currentRaw }: { asset: string; ask?: string; openingRaw: bigint | null; currentRaw: bigint | null }) {
  const mk = useMk();
  return (
    <>
      <Text style={[mkType.question, { color: mk.ink }]} accessibilityRole="header">
        {openingRaw === null ? (
          HERO_HEAD.pair(asset, assetPairUnit(asset))
        ) : (
          <>
            {ask ?? HERO_HEAD.holdsAbove(asset)} <Text style={{ color: mk.vermilion }}>{assetPriceLine(asset, openingRaw)}</Text>?
          </>
        )}
      </Text>
      <View style={styles.distance}>
        {openingRaw === null || currentRaw === null ? (
          <Text style={[mkType.distance, { color: mk.gray500 }]}>{openingRaw === null ? HERO.pendingDistance : HERO.noLivePrice}</Text>
        ) : (
          <Distance asset={asset} openingRaw={openingRaw} currentRaw={currentRaw} />
        )}
      </View>
    </>
  );
}

function Distance({ asset, openingRaw, currentRaw }: { asset: string; openingRaw: bigint; currentRaw: bigint }) {
  const mk = useMk();
  const move = neededMove(currentRaw, openingRaw);
  const winning = move.upNeedsRaw === 0n;
  const magnitude = winning ? currentRaw - openingRaw : move.upNeedsRaw;
  return (
    <Text style={[mkType.distanceValue, { color: winning ? mk.profit : mk.loss }]}>
      {winning ? `${assetPriceLine(asset, magnitude, openingRaw)} ${HERO_HEAD.aboveLine}` : `${HERO_HEAD.needs} +${assetPriceLine(asset, magnitude, openingRaw)} ${HERO_HEAD.needsForUp}`}
    </Text>
  );
}

/** `.mh-settles`: the clock's label over the clock; the whole block flips vermilion as it runs out. */
export function Settles({ label, value, urgent = false }: { label: string; value: string; urgent?: boolean }) {
  const mk = useMk();
  return (
    <View style={styles.settles} accessibilityRole="timer">
      <Text style={[mkType.settlesLabel, { color: urgent ? mk.urgentLabel : mk.gray600 }]}>{label}</Text>
      <Text style={[mkType.settlesValue, { color: urgent ? mk.vermilion : mk.ink }]}>{value}</Text>
    </View>
  );
}

export const headStyles = StyleSheet.create({
  /** `.mh-distance` with its 10 px lead, the change and its quiet "since" word sharing it. */
  distance: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", columnGap: 8, rowGap: 2, marginTop: 10 },
});

const styles = StyleSheet.create({
  head: { flexDirection: "row", justifyContent: "space-between", gap: 10, paddingVertical: 12, paddingHorizontal: 14 },
  left: { flex: 1, minWidth: 0 },
  assetRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 10 },
  tabs: { flexDirection: "row", alignItems: "flex-end", gap: 12, flexShrink: 1 },
  tab: { paddingBottom: 4, flexShrink: 1 },
  underline: { position: "absolute", left: 0, right: 0, bottom: 0, height: 1 },
  distance: headStyles.distance,
  settles: { flexShrink: 0 },
});
