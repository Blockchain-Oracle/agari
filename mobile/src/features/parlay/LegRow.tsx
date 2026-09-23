import { formatCadence } from "@agari/core/market";
import type { EventMarket, Side } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInLeft, useReducedMotion } from "react-native-reanimated";
import { PARLAY } from "@/features/parlay/copy";
import { formatBpsPct, formatLine, type ThinBook } from "@/features/parlay/format";
import { EmptyState, haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { Clock } from "~/features/short/Clock";
import { FONT, RADIUS, SPACE, TYPE, useTheme } from "~/theme";

const B = PARLAY.builder;

export interface DraftLeg {
  key: string;
  marketId: EventMarket["marketId"];
  /** The lane the leg lives on, so it can follow the lane when its Window rolls. */
  asset: string;
  intervalSec: number;
  side: Side;
}

interface LegRowProps {
  index: number;
  leg: DraftLeg;
  market: EventMarket | null;
  windows: readonly EventMarket[];
  legProbBps: number | null;
  thin: ThinBook | null;
  decimals: number;
  nowMs: number;
  onPatch: (key: string, patch: Partial<DraftLeg>) => void;
  onRemove: (key: string) => void;
}

// 21st: isaiahbjork/prediction-market-card — the spring-in row, the Up/Down pair and the live clock beside the call.
/**
 * web's `features/parlay/LegRow.tsx`: the numbered stamp, the Window picker (a native sheet here), remove, the Up/Down
 * pair, the line (the Window's opening print — not a choice on this venue) and the live per-leg probability.
 */
export function LegRow({ index, leg, market, windows, legProbBps, thin, decimals, nowMs, onPatch, onRemove }: LegRowProps) {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const [picking, setPicking] = useState(false);
  const contracts = (raw: bigint) => formatBaseUnits(raw, decimals, { minDp: 0, maxDp: 2 });

  return (
    <Animated.View
      entering={reduce ? undefined : FadeInLeft.springify().damping(28)}
      style={[styles.leg, { backgroundColor: color.surface1, borderColor: color.hairline }]}
    >
      <View style={styles.row}>
        <View style={[styles.stamp, { borderColor: color.accent }]}>
          <Text style={[TYPE.data, { color: color.accent }]}>{index + 1}</Text>
        </View>
        <Pressable
          onPress={() => {
            haptic.tap();
            setPicking(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={B.pickWindow}
          style={[styles.picker, { backgroundColor: color.surface2 }]}
        >
          {market ? <AssetDisc asset={market.asset} size={22} /> : null}
          <Text style={[TYPE.bodyStrong, styles.pickerText, { color: market ? color.ink : color.warning }]} numberOfLines={1}>
            {market ? `${market.asset} ${formatCadence(market.intervalSec)}` : B.settled}
          </Text>
          {market ? <Clock expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} /> : null}
          <SymbolView name={{ ios: "chevron.down", android: "expand_more" }} size={14} tintColor={color.inkMuted} />
        </Pressable>
        <Pressable
          onPress={() => {
            haptic.tap();
            onRemove(leg.key);
          }}
          accessibilityRole="button"
          accessibilityLabel={B.remove}
          style={styles.remove}
        >
          <SymbolView name={{ ios: "xmark", android: "close" }} size={16} tintColor={color.inkSecondary} />
        </Pressable>
      </View>

      <View style={styles.row}>
        <SideButton side="up" on={leg.side === "up"} onPress={() => onPatch(leg.key, { side: "up" })} />
        <SideButton side="down" on={leg.side === "down"} onPress={() => onPatch(leg.key, { side: "down" })} />
        <View style={styles.line}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{B.line}</Text>
          <Text style={[TYPE.data, { color: market?.openingPriceRaw != null ? color.ink : color.inkMuted }]} numberOfLines={1}>
            {market?.openingPriceRaw != null ? formatLine(market.openingPriceRaw, market.asset) : market ? B.linePending : "···"}
          </Text>
        </View>
        <Text style={[TYPE.dataLg, { color: color.ink }]}>{thin ? "" : legProbBps !== null ? formatBpsPct(legProbBps) : "·"}</Text>
      </View>
      {thin ? <Text style={[TYPE.caption, { color: color.loss }]}>{B.thin(contracts(thin.filledRaw), contracts(thin.depthRaw))}</Text> : null}

      <WindowSheet
        visible={picking}
        windows={windows}
        chosen={leg.marketId}
        nowMs={nowMs}
        onClose={() => setPicking(false)}
        onChoose={(next) => {
          onPatch(leg.key, { marketId: next.marketId, asset: next.asset, intervalSec: next.intervalSec });
          setPicking(false);
        }}
      />
    </Animated.View>
  );
}

function SideButton({ side, on, onPress }: { side: Side; on: boolean; onPress: () => void }) {
  const { color } = useTheme();
  const ink = side === "up" ? color.profit : color.loss;
  const wash = side === "up" ? color.profitWash : color.lossWash;
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={side === "up" ? B.up : B.down}
      style={[styles.side, { backgroundColor: on ? wash : "transparent", borderColor: on ? ink : color.hairline }]}
    >
      <SymbolView
        name={side === "up" ? { ios: "arrow.up.right", android: "trending_up" } : { ios: "arrow.down.right", android: "trending_down" }}
        size={14}
        tintColor={on ? ink : color.inkSecondary}
      />
      <Text style={[styles.sideText, { color: on ? ink : color.inkSecondary }]}>{side === "up" ? B.up : B.down}</Text>
    </Pressable>
  );
}

/** The leg's Window menu (web's `.pl-menu` listbox) as a page sheet: every live Window, soonest first. */
function WindowSheet({ visible, windows, chosen, nowMs, onClose, onChoose }: {
  visible: boolean;
  windows: readonly EventMarket[];
  chosen: string;
  nowMs: number;
  onClose: () => void;
  onChoose: (market: EventMarket) => void;
}) {
  const { color } = useTheme();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: color.ground }]}>
        <View style={styles.sheetHead}>
          <Text style={[TYPE.title, { color: color.ink }]}>{B.pickWindow}</Text>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Done" hitSlop={12} style={styles.done}>
            <Text style={[TYPE.bodyStrong, { color: color.accent }]}>Done</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.sheetBody}>
          {windows.length === 0 ? <EmptyState why={B.noMarkets} /> : null}
          {windows.map((w) => {
            const on = w.marketId === chosen;
            return (
              <Pressable
                key={w.marketId}
                onPress={() => {
                  haptic.select();
                  onChoose(w);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${w.asset} ${formatCadence(w.intervalSec)}`}
                style={[styles.option, { backgroundColor: on ? color.accentWash : color.surface1, borderColor: on ? color.accent : color.hairline }]}
              >
                <AssetDisc asset={w.asset} size={28} />
                <Text style={[TYPE.bodyStrong, styles.pickerText, { color: color.ink }]}>
                  {w.asset} {formatCadence(w.intervalSec)}
                </Text>
                <Clock expirySec={w.expirySec} intervalSec={w.intervalSec} nowMs={nowMs} />
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  leg: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 12, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  stamp: { width: 28, height: 28, borderRadius: RADIUS.full, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  picker: { flex: 1, minHeight: 44, borderRadius: RADIUS.md, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  pickerText: { flex: 1 },
  remove: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  side: { minHeight: 44, paddingHorizontal: 12, borderRadius: RADIUS.md, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 4 },
  sideText: { fontFamily: FONT.bodyStrong, fontSize: 14 },
  line: { flex: 1, alignItems: "flex-end", gap: 2 },
  sheet: { flex: 1 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: SPACE.gutter, paddingTop: 18, paddingBottom: 8 },
  done: { minHeight: 44, justifyContent: "center" },
  sheetBody: { padding: SPACE.gutter, gap: 8, paddingBottom: 48 },
  option: { minHeight: 56, borderRadius: RADIUS.md, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
});
