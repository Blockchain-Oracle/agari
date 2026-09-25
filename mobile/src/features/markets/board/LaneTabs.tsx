import type { TickerSymbol } from "@agari/core/market";
import type { Lane, LaneBasis } from "@agari/core/types";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { compareLaneTabKeys, laneAssetLabel, laneTabKey, laneTabLabel, laneTabParts, pausedCopy, type LaneTabKey } from "@/features/markets/lanes/lane-view";
import { MARKETS } from "@/lib/copy";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";
import { lanesTokens } from "~/theme/web/markets-lanes";

interface Tab {
  key: LaneTabKey;
  label: string;
  count: number;
}

/** web LaneTabs' `buildTabs`: every live lane, the pinned one with no Window, and the lanes ops configures, in board order. */
function buildTabs(lanes: readonly Lane[], pinnedMissing: LaneTabKey | null, extraKeys: readonly LaneTabKey[]): Tab[] {
  const tabs: Tab[] = lanes.map((lane) => ({ key: laneTabKey(lane.basis, lane.intervalSec), label: laneTabLabel(lane.basis, lane.intervalSec), count: lane.markets.length }));
  for (const key of [...(pinnedMissing === null ? [] : [pinnedMissing]), ...extraKeys]) {
    if (tabs.some((tab) => tab.key === key)) continue;
    const { basis, intervalSec } = laneTabParts(key);
    tabs.push({ key, label: laneTabLabel(basis, intervalSec), count: 0 });
  }
  return tabs.sort((a, b) => compareLaneTabKeys(a.key, b.key));
}

interface LaneTabsProps {
  lanes: readonly Lane[];
  activeKey: LaneTabKey | null;
  pinnedMissingKey: LaneTabKey | null;
  extraKeys?: readonly LaneTabKey[];
  onPin: (key: LaneTabKey) => void;
}

/**
 * web's LaneTabs — ui/tabs' `line` list at `h-touch`: one trigger per (basis, cadence) lane with its live count in the
 * micro label, the active one in full ink and the rest in the secondary ink, scrolling sideways past the gutter.
 */
export function LaneTabs({ lanes, activeKey, pinnedMissingKey, extraKeys = [], onPin }: LaneTabsProps) {
  const { name } = useTheme();
  const t = lanesTokens(name);
  const tabs = buildTabs(lanes, pinnedMissingKey, extraKeys);
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.list} contentContainerStyle={styles.listInner} accessibilityRole="tablist" accessibilityLabel="Cadence">
      {tabs.map((tab) => {
        const on = tab.key === activeKey;
        return (
          <Pressable
            key={tab.key}
            onPress={() => {
              haptic.select();
              onPin(tab.key);
            }}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={styles.trigger}
          >
            <Text style={[styles.label, { color: on ? t.ink : t.inkSecondary }]}>{tab.label}</Text>
            <Text style={[styles.count, { color: t.inkMuted }]} accessibilityLabel={MARKETS.live(tab.count)}>
              {tab.count}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

interface TickerPickerProps {
  tickers: readonly TickerSymbol[];
  basis: LaneBasis;
  paused: ReadonlyMap<TickerSymbol, string>;
  ticker: TickerSymbol | null;
  onPick: (ticker: TickerSymbol | null) => void;
}

/**
 * web's TickerPicker (`.asset-tabs.tkp`, the leaderboard's `.asset-tab`): "All" and one mono-caps tab per ticker with
 * its 16 px disc, a vermilion underline under the pinned one, a paused ticker a step quieter; it scrolls sideways.
 */
export function TickerPicker({ tickers, basis, paused, ticker, onPick }: TickerPickerProps) {
  const { name } = useTheme();
  const t = lanesTokens(name);
  const tab = (key: string, on: boolean, quiet: boolean, label: string, onPress: () => void, glyph?: string, hint?: string) => (
    <Pressable
      key={key}
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityHint={hint}
      style={[styles.assetTab, { borderBottomColor: on ? t.vermilion : "transparent" }]}
    >
      {glyph ? (
        <View style={styles.glyph}>
          <AssetDisc asset={glyph} size={14} />
        </View>
      ) : null}
      <Text style={[styles.assetLabel, { color: on ? t.ink : quiet ? t.gray600 : t.inkMuted }]}>{label}</Text>
    </Pressable>
  );
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.picker} accessibilityLabel={MARKETS.tickers.group}>
      {tab("all", ticker === null, false, MARKETS.tickers.all, () => onPick(null))}
      {tickers.map((symbol) => {
        const state = paused.get(symbol);
        const label = laneAssetLabel(symbol, basis);
        return tab(symbol, ticker === symbol, state !== undefined, label, () => onPick(symbol), symbol, state === undefined ? undefined : pausedCopy(state, label, basis, 0).headline);
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  list: { height: 44, flexGrow: 0 },
  listInner: { alignItems: "center", gap: 4, padding: 3 },
  trigger: { height: 37, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 2, paddingHorizontal: 12, borderRadius: 8 },
  label: { fontFamily: FONT.bodyMedium, fontSize: 13.125, lineHeight: 18.75 },
  count: { fontFamily: FONT.bodyMedium, fontSize: 11, lineHeight: 13.2, letterSpacing: 1.76, textTransform: "uppercase", fontVariant: ["tabular-nums"] },
  picker: { flexDirection: "row", alignItems: "center", gap: 18 },
  assetTab: { minHeight: 32, flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4, borderBottomWidth: 1 },
  glyph: { width: 16, height: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  assetLabel: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6, letterSpacing: 1.1, textTransform: "uppercase" },
});
