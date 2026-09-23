import type { TickerSymbol } from "@agari/core/market";
import type { Lane, LaneBasis } from "@agari/core/types";
import { useRef } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { compareLaneTabKeys, laneAssetLabel, laneTabKey, laneTabLabel, laneTabParts, pausedCopy, type LaneTabKey } from "@/features/markets/lanes/lane-view";
import { MARKETS } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";

interface Tab {
  key: LaneTabKey;
  label: string;
  count: number;
}

/** web's LaneTabs `buildTabs`: every live lane, the pinned one with no Window, and the lanes ops configures, board order. */
function buildTabs(lanes: readonly Lane[], pinnedMissing: LaneTabKey | null, extraKeys: readonly LaneTabKey[]): Tab[] {
  const tabs: Tab[] = lanes.map((lane) => ({ key: laneTabKey(lane.basis, lane.intervalSec), label: laneTabLabel(lane.basis, lane.intervalSec), count: lane.markets.length }));
  for (const key of [...(pinnedMissing === null ? [] : [pinnedMissing]), ...extraKeys]) {
    if (tabs.some((tab) => tab.key === key)) continue;
    const { basis, intervalSec } = laneTabParts(key);
    tabs.push({ key, label: laneTabLabel(basis, intervalSec), count: 0 });
  }
  return tabs.sort((a, b) => compareLaneTabKeys(a.key, b.key));
}

/**
 * web's LaneTabs: one tab per (basis, cadence) lane — `5m`, `15m`, `Gap`, `5m · 24/7` — with its live count, scrolling
 * sideways under the thumb. The choice is pinned (`agari.lane`) and survives a reload.
 */
export function LaneTabs({ lanes, activeKey, pinnedMissingKey, extraKeys, onPin }: {
  lanes: readonly Lane[];
  activeKey: LaneTabKey | null;
  pinnedMissingKey: LaneTabKey | null;
  extraKeys: readonly LaneTabKey[];
  onPin: (key: LaneTabKey) => void;
}) {
  const { color } = useTheme();
  const tabs = buildTabs(lanes, pinnedMissingKey, extraKeys);
  const scroller = useRef<ScrollView>(null);
  return (
    <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row} accessibilityRole="tablist" accessibilityLabel="Cadence">
      {tabs.map((tab) => {
        const on = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => {
              if (on) return;
              haptic.select();
              onPin(tab.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={`${tab.label}, ${MARKETS.live(tab.count)}`}
            // The pinned lane may sit past the edge (a 24/7 lane): bring it into view once laid out.
            onLayout={on ? (event) => scroller.current?.scrollTo({ x: Math.max(0, event.nativeEvent.layout.x - 16), animated: false }) : undefined}
            style={[styles.tab, { borderBottomColor: on ? color.accent : "transparent" }]}
          >
            <Text style={[styles.label, { color: on ? color.ink : color.inkSecondary }]}>{tab.label}</Text>
            <Text style={[TYPE.data, styles.count, { color: on ? color.accent : color.inkMuted }]}>{tab.count}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/**
 * web's TickerPicker: narrows the lane to one ticker (`agari.ticker`, kept across cadences). A paused ticker keeps its
 * chip and says why when chosen.
 */
export function TickerPicker({ tickers, basis, paused, ticker, onPick }: {
  tickers: readonly TickerSymbol[];
  basis: LaneBasis;
  paused: ReadonlyMap<TickerSymbol, string>;
  ticker: TickerSymbol | null;
  onPick: (ticker: TickerSymbol | null) => void;
}) {
  const { color } = useTheme();
  const chip = (key: string, on: boolean, label: string, onPress: () => void, symbol?: TickerSymbol, hint?: string) => (
    <Pressable
      key={key}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityHint={hint}
      style={[styles.chip, { borderColor: on ? color.ink : color.hairline, backgroundColor: on ? color.surface3 : color.surface1 }]}
    >
      {symbol ? <AssetDisc asset={symbol} size={20} /> : null}
      <Text style={[styles.chipText, { color: on ? color.ink : color.inkSecondary }]}>{label}</Text>
      {symbol && paused.has(symbol) ? <View style={[styles.pausedDot, { backgroundColor: color.warning }]} /> : null}
    </Pressable>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityLabel={MARKETS.tickers.group}>
      {chip("all", ticker === null, MARKETS.tickers.all, () => onPick(null))}
      {tickers.map((symbol) => {
        const state = paused.get(symbol);
        const label = laneAssetLabel(symbol, basis);
        return chip(symbol, ticker === symbol, label, () => onPick(symbol), symbol, state ? pausedCopy(state, label, basis, 0).headline : undefined);
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 4 },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: 12, borderBottomWidth: 2 },
  label: { fontFamily: FONT.bodyStrong, fontSize: 15 },
  count: { fontSize: 11 },
  chips: { gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: 12, borderRadius: RADIUS.full, borderWidth: 1 },
  chipText: { fontFamily: FONT.bodyStrong, fontSize: 13 },
  pausedDot: { width: 6, height: 6, borderRadius: 3 },
});
