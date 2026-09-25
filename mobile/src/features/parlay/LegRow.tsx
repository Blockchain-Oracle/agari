import { formatCadence } from "@agari/core/market";
import type { EventMarket, MarketId, Side } from "@agari/core/types";
import { formatBaseUnits } from "@agari/core/units";
import { ChevronDown, TrendingDown, TrendingUp, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PARLAY } from "@/features/parlay/copy";
import { formatBpsPct, formatLine, type ThinBook } from "@/features/parlay/format";
import { FONT } from "~/theme";
import { useEarnParlay } from "~/features/earn/EarnKit";
import { Countdown, Rise } from "./ParlayKit";

export interface DraftLeg {
  key: string;
  marketId: MarketId;
  /** The lane the leg lives on, so it can follow the lane when its Window rolls. */
  asset: string;
  intervalSec: number;
  side: Side;
}

interface LegRowProps {
  index: number;
  leg: DraftLeg;
  /** The Window the leg names, or null once it has left the live set. */
  market: EventMarket | null;
  windows: readonly EventMarket[];
  legProbBps: number | null;
  /** The reserve's `ThinBook` for this leg's Window, when that is why the ticket has no price. */
  thin: ThinBook | null;
  decimals: number;
  nowMs: number;
  onPatch: (key: string, patch: Partial<DraftLeg>) => void;
  onRemove: (key: string) => void;
}

interface Anchor {
  x: number;
  y: number;
  width: number;
}

/**
 * web's `features/parlay/LegRow.tsx` (`.pl-leg`): the numbered stamp, the Window picker and its menu, remove, the
 * Up/Down pair, the read-only line (the Window's opening print), the live per-leg probability. The menu drops under
 * the picker as web's absolute `.pl-menu` does, drawn in a transparent Modal so it can overhang the leg.
 */
export function LegRow({ index, leg, market, windows, legProbBps, thin, decimals, nowMs, onPatch, onRemove }: LegRowProps) {
  const { color, t } = useEarnParlay();
  const { builder } = PARLAY;
  const picker = useRef<View>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const open = anchor !== null;

  const toggle = () => {
    if (open) return setAnchor(null);
    picker.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y: y + height + 4, width }));
  };
  const choose = (next: EventMarket) => {
    onPatch(leg.key, { marketId: next.marketId, asset: next.asset, intervalSec: next.intervalSec });
    setAnchor(null);
  };
  const upOn = leg.side === "up";

  return (
    <Rise style={[styles.leg, { borderColor: t.legBorder, backgroundColor: t.legBg }]}>
      <View style={styles.inner}>
        <View style={[styles.stamp, { borderRightColor: t.legBorder, backgroundColor: t.stampBg }]}>
          <Text style={[styles.num, { color: color.accent }]}>{index + 1}</Text>
        </View>

        <View style={styles.main}>
          <View style={styles.row}>
            <View ref={picker} collapsable={false} style={styles.picker}>
              <Pressable
                onPress={toggle}
                accessibilityRole="button"
                accessibilityLabel={builder.pickWindow}
                accessibilityState={{ expanded: open }}
                style={[styles.pickerBtn, { backgroundColor: t.inputBg, borderColor: open ? t.inputFocus : t.inputBorder }]}
              >
                <Text numberOfLines={1} style={[styles.label, { color: color.ink }]}>
                  {market ? (
                    <>
                      {market.asset} {formatCadence(market.intervalSec)} · <Countdown expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} />
                    </>
                  ) : (
                    builder.settled
                  )}
                </Text>
                <View style={open ? styles.chevronOpen : null}>
                  <ChevronDown size={12} color={color.inkMuted} />
                </View>
              </Pressable>
            </View>
            <Pressable onPress={() => onRemove(leg.key)} accessibilityRole="button" accessibilityLabel={builder.remove} style={({ pressed }) => [styles.remove, pressed ? { backgroundColor: t.removeHover } : null]}>
              {({ pressed }) => <X size={14} color={pressed ? color.loss : color.inkDisabled} />}
            </Pressable>
          </View>

          <View style={styles.row}>
            <View style={[styles.sides, { borderColor: t.toggleBorder }]}>
              <Pressable onPress={() => onPatch(leg.key, { side: "up" })} accessibilityRole="button" accessibilityState={{ selected: upOn }} style={[styles.side, upOn ? { backgroundColor: t.upOnBg } : null]}>
                <TrendingUp size={12} color={upOn ? color.profit : color.inkMuted} />
                <Text style={[styles.sideText, { color: upOn ? color.profit : color.inkMuted }]}>{builder.up}</Text>
              </Pressable>
              <Pressable onPress={() => onPatch(leg.key, { side: "down" })} accessibilityRole="button" accessibilityState={{ selected: !upOn }} style={[styles.side, !upOn ? { backgroundColor: t.downOnBg } : null]}>
                <TrendingDown size={12} color={!upOn ? color.loss : color.inkMuted} />
                <Text style={[styles.sideText, { color: !upOn ? color.loss : color.inkMuted }]}>{builder.down}</Text>
              </Pressable>
            </View>

            <View style={[styles.line, { backgroundColor: t.inputBg, borderColor: t.inputBorder }]}>
              <Text style={[styles.lineLabel, { color: color.inkDisabled }]}>{builder.line}</Text>
              {market?.openingPriceRaw != null ? (
                <Text numberOfLines={1} style={[styles.label, styles.bold, { color: color.ink }]}>
                  {formatLine(market.openingPriceRaw, market.asset)}
                </Text>
              ) : (
                <Text numberOfLines={1} style={[styles.pending, { color: color.inkMuted }]}>
                  {market ? builder.linePending : "···"}
                </Text>
              )}
            </View>

            {thin ? (
              <Text style={[styles.prob, styles.probThin, { color: color.accent }]}>
                {builder.thin(formatBaseUnits(thin.filledRaw, decimals, { minDp: 0, maxDp: 2 }), formatBaseUnits(thin.depthRaw, decimals, { minDp: 0, maxDp: 2 }))}
              </Text>
            ) : (
              <Text style={[styles.prob, { color: t.vermilion80 }]}>{legProbBps !== null ? formatBpsPct(legProbBps) : "·"}</Text>
            )}
          </View>
        </View>
      </View>

      <Modal visible={open} transparent statusBarTranslucent animationType="none" onRequestClose={() => setAnchor(null)}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setAnchor(null)} accessibilityLabel="Close" />
        {anchor ? (
          <Rise drop style={[styles.menu, { top: anchor.y, left: anchor.x, width: anchor.width, backgroundColor: t.menuBg, borderColor: t.menuBorder, boxShadow: t.menuShadow }]}>
            <ScrollView style={styles.menuScroll} showsVerticalScrollIndicator={false} accessibilityRole="list">
              {windows.length === 0 ? <Text style={[styles.menuEmpty, { color: color.inkDisabled }]}>{builder.noMarkets}</Text> : null}
              {windows.map((w) => {
                const on = w.marketId === leg.marketId;
                return (
                  <Pressable
                    key={w.marketId}
                    onPress={() => choose(w)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    style={({ pressed }) => [styles.menuItem, on ? { backgroundColor: t.menuOn } : pressed ? { backgroundColor: t.pillBg } : null]}
                  >
                    <Text style={[styles.menuText, { color: on ? color.ink : color.inkSecondary }]}>
                      {w.asset} {formatCadence(w.intervalSec)}
                    </Text>
                    <Text style={[styles.menuWhen, { color: color.inkMuted }]}>
                      <Countdown expirySec={w.expirySec} intervalSec={w.intervalSec} nowMs={nowMs} />
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Rise>
        ) : null}
      </Modal>
    </Rise>
  );
}

const styles = StyleSheet.create({
  leg: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  inner: { flexDirection: "row", alignItems: "stretch" },
  stamp: { width: 40, alignItems: "center", justifyContent: "center", borderRightWidth: 1 },
  num: { fontFamily: FONT.headingHeavy, fontSize: 16, lineHeight: 16 },
  main: { flex: 1, minWidth: 0, padding: 12, gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  picker: { flex: 1, minWidth: 0 },
  pickerBtn: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 6, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  label: { flexShrink: 1, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 18 },
  bold: { fontFamily: FONT.dataStrong },
  chevronOpen: { transform: [{ rotate: "180deg" }] },
  remove: { padding: 6, borderRadius: 8 },
  sides: { flexDirection: "row", borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  side: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 6, paddingHorizontal: 10 },
  sideText: { fontFamily: FONT.bodyStrong, fontSize: 11, lineHeight: 16.5 },
  line: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1 },
  lineLabel: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 13.5, letterSpacing: 1.44, textTransform: "uppercase" },
  pending: { flexShrink: 1, fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 18 },
  prob: { width: 36, textAlign: "right", fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 16.5 },
  probThin: { width: "auto" },
  menu: { position: "absolute", borderRadius: 8, borderWidth: 1, overflow: "hidden" },
  menuScroll: { maxHeight: 176 },
  menuEmpty: { paddingVertical: 8, paddingHorizontal: 12, fontFamily: FONT.body, fontSize: 11 },
  menuItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 8, paddingHorizontal: 12 },
  menuText: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 16 },
  menuWhen: { fontFamily: FONT.dataRegular, fontSize: 10 },
});
