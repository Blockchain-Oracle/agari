import { formatCadence } from "@agari/core/copy";
import type { EventMarket } from "@agari/core/types";
import { CalendarClock } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useDeskMarks } from "@/features/desk/useDeskMarks";
import { useTopOfBook } from "@/features/markets/hero/useTopOfBook";
import { SHORT } from "@/features/short/copy";
import { isLiveWindow, opensAt, type ShortKind, type ShortStock } from "@/features/short/useShortWindows";
import { haptic } from "~/components/kit";
import { Shimmer } from "~/features/baskets/DeskKit";
import { FONT, useTheme } from "~/theme";
import { basketsShortTokens } from "~/theme/web/products/baskets-short";
import { Clock } from "./Clock";
import { ShortAssetPicker, ShortPickSummary } from "./ShortAssetPicker";

const P = SHORT.picker;

type Filter = "all" | "stock" | "allDay";
const FILTER_KINDS: Record<Filter, readonly ShortKind[] | null> = { all: null, stock: ["stock"], allDay: ["preIpo", "basket"] };

interface ShortPickerProps {
  stocks: ShortStock[];
  loading: boolean;
  selected: EventMarket | null;
  onSelect: (market: EventMarket) => void;
  nowMs: number;
}

/** The `.sh-picker` / `.sh-ticket` shell (short-page.css under short-picker.css): the card surface, 16 px in on a phone. */
export function usePanelStyle() {
  const { name } = useTheme();
  const t = basketsShortTokens(name);
  return [styles.panel, { backgroundColor: t.panelBg, borderColor: t.panelBorder }, t.panelShadow === "none" ? null : { boxShadow: t.panelShadow }];
}

/**
 * web's `features/short/ShortPicker.tsx`: "What to short" with the All · Stocks · 24/7 filter, the names, the chosen
 * one in full, "How long" as cadence chips, then that cadence's Windows — live ones priced from their own Down ask,
 * later ones dashed with the time they open.
 */
export function ShortPicker({ stocks, loading, selected, onSelect, nowMs }: ShortPickerProps) {
  const { color } = useTheme();
  const panel = usePanelStyle();
  const marks = useDeskMarks();
  const [filter, setFilter] = useState<Filter>("all");
  if (loading) {
    return (
      <View style={panel}>
        <Shimmer width="100%" height={180} radius={12} label={P.loading} />
      </View>
    );
  }
  if (stocks.length === 0) return <EmptyPicker />;

  const kinds = FILTER_KINDS[filter];
  const shown = kinds ? stocks.filter((s) => kinds.includes(s.kind)) : stocks;
  const stock = stocks.find((s) => s.windows.some((w) => w.marketId === selected?.marketId)) ?? shown[0] ?? stocks[0];
  if (!stock) return null;
  const cadences = [...new Set(stock.windows.map((w) => w.intervalSec))].sort((a, b) => a - b);
  const cadence = selected && selected.asset === stock.asset ? selected.intervalSec : (cadences[0] ?? 0);
  const windows = stock.windows.filter((w) => w.intervalSec === cadence);
  const counts: Record<Filter, number> = { all: stocks.length, stock: stocks.filter((s) => s.kind === "stock").length, allDay: stocks.filter((s) => s.kind !== "stock").length };

  return (
    <View style={panel}>
      <View style={styles.head}>
        <Text style={[styles.k, { color: color.inkMuted }]}>{P.stock}</Text>
        <View style={[styles.filters, { backgroundColor: color.surface2 }]} accessibilityLabel={P.filterAria}>
          {(["all", "stock", "allDay"] as const)
            .filter((f) => f === "all" || counts[f] > 0)
            .map((f) => (
              <FilterButton key={f} on={filter === f} label={P.filter[f]} count={counts[f]} onPress={() => setFilter(f)} />
            ))}
        </View>
      </View>
      <ShortAssetPicker
        stocks={shown}
        value={stock.asset}
        onChange={(asset) => {
          const next = stocks.find((s) => s.asset === asset)?.windows[0];
          if (next) onSelect(next);
        }}
      />

      <ShortPickSummary stock={stock} marks={marks} />
      <Text style={[styles.k, styles.kGap, { color: color.inkMuted }]}>{P.window}</Text>
      <View style={styles.cadences} accessibilityLabel={P.cadenceAria}>
        {cadences.map((c) => {
          const first = stock.windows.find((w) => w.intervalSec === c);
          const live = stock.windows.some((w) => w.intervalSec === c && isLiveWindow(w, nowMs));
          const on = c === cadence;
          return (
            <Pressable
              key={c}
              onPress={() => {
                haptic.select();
                if (first) onSelect(first);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              style={[styles.cadence, on ? { borderColor: color.accent, backgroundColor: color.accentWash } : { borderColor: color.hairline }]}
            >
              <View style={[styles.cadenceDot, live ? { backgroundColor: color.profit, boxShadow: `0px 0px 0px 3px ${color.profitWash}` } : { backgroundColor: color.inkMuted }]} />
              <Text style={[styles.cadenceText, { color: on ? color.ink : color.inkSecondary }]}>{formatCadence(c)}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.windows} accessibilityLabel={P.window}>
        {windows.map((market) => (
          <WindowRow key={market.marketId} market={market} on={market.marketId === selected?.marketId} onSelect={onSelect} nowMs={nowMs} />
        ))}
      </View>
    </View>
  );
}

/** `.sh-filter`: the pressed one lifts onto the card surface. */
function FilterButton({ on, label, count, onPress }: { on: boolean; label: string; count: number; onPress: () => void }) {
  const { color, name } = useTheme();
  const t = basketsShortTokens(name);
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.filter, on ? { backgroundColor: color.surface1, boxShadow: t.filterShadow } : null]}
    >
      <Text style={[styles.filterText, { color: on ? color.ink : color.inkSecondary }]}>{label}</Text>
      <Text style={[styles.filterN, { color: color.inkMuted }]}>{count}</Text>
    </Pressable>
  );
}

/** desk-kit `EmptyState` with lucide's CalendarClock: nothing listed to short yet. */
function EmptyPicker() {
  const { color } = useTheme();
  return (
    <View style={[styles.empty, { borderColor: color.hairline }]}>
      <View style={[styles.emptyIcon, { backgroundColor: color.surface2 }]}>
        <CalendarClock size={24} color={color.inkSecondary} />
      </View>
      <Text style={[styles.emptyTitle, { color: color.ink }]}>{P.noneTitle}</Text>
      <Text style={[styles.emptyBody, { color: color.inkSecondary }]}>{P.noneBody}</Text>
    </View>
  );
}

/** `.sh-window`: cadence, then time left and the Down ask — or, dashed, when it opens. */
function WindowRow({ market, on, onSelect, nowMs }: { market: EventMarket; on: boolean; onSelect: (m: EventMarket) => void; nowMs: number }) {
  const { color, name } = useTheme();
  const t = basketsShortTokens(name);
  const live = isLiveWindow(market, nowMs);
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onSelect(market);
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.window, { borderColor: on ? t.windowOnBorder : t.windowBorder, borderStyle: live ? "solid" : "dashed" }, on ? { backgroundColor: color.accentWash } : null]}
    >
      <Text style={[styles.windowC, { color: color.ink }]}>{formatCadence(market.intervalSec)}</Text>
      {live ? <LiveTerms market={market} nowMs={nowMs} /> : <Text style={[styles.windowT, { color: color.inkSecondary }]}>{P.opens(opensAt(market.tradingStartSec))}</Text>}
    </Pressable>
  );
}

/** A live Window prices itself from the top of its own book: the Down ask, what a dollar of the fall costs now. */
function LiveTerms({ market, nowMs }: { market: EventMarket; nowMs: number }) {
  const { color } = useTheme();
  const { downCents, hydrating } = useTopOfBook(market);
  return (
    <>
      <Text style={[styles.windowT, { color: color.inkSecondary }]}>
        <Clock expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} /> {P.left}
      </Text>
      <View style={styles.price}>
        <Text style={[styles.priceK, { color: color.inkMuted }]}>{P.costLabel}</Text>
        <Text style={[styles.priceV, { color: color.ink }]}>{hydrating ? P.costPending : downCents === null ? P.noQuotes : P.cost(downCents)}</Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 16, borderWidth: 1, borderRadius: 12 },
  head: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 },
  k: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 1.6, textTransform: "uppercase" },
  kGap: { marginTop: 20, marginBottom: 8 },
  filters: { flexDirection: "row", gap: 4, padding: 3, borderRadius: 9999 },
  filter: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 9999 },
  filterText: { fontFamily: FONT.bodyStrong, fontSize: 12, lineHeight: 19.2 },
  filterN: { fontFamily: FONT.dataRegular, fontSize: 10.5, lineHeight: 16.8 },
  cadences: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  cadence: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 36, paddingHorizontal: 16, borderWidth: 1, borderRadius: 9999 },
  cadenceDot: { width: 7, height: 7, borderRadius: 3.5 },
  cadenceText: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 20.8 },
  windows: { gap: 8 },
  window: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderRadius: 12 },
  windowC: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 20.8 },
  windowT: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  price: { marginLeft: "auto", alignItems: "flex-end", gap: 1 },
  priceK: { fontFamily: FONT.dataRegular, fontSize: 8, lineHeight: 12.8, letterSpacing: 1.28, textTransform: "uppercase" },
  priceV: { fontFamily: FONT.body, fontSize: 14, lineHeight: 15.4, fontVariant: ["tabular-nums"] },
  empty: { alignItems: "center", gap: 8, paddingVertical: 32, paddingHorizontal: 16, borderWidth: 1, borderStyle: "dashed", borderRadius: 14 },
  emptyIcon: { width: 48, height: 48, marginBottom: 4, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontFamily: FONT.heading, fontSize: 15, lineHeight: 24, textAlign: "center" },
  emptyBody: { maxWidth: 260, fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8, textAlign: "center" },
});
