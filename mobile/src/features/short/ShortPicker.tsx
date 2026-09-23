import { formatCadence } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useDeskMarks, type DeskMarks } from "@/features/desk/useDeskMarks";
import { useTopOfBook } from "@/features/markets/hero/useTopOfBook";
import { useMarketSession } from "@/features/markets/session/useMarketSession";
import { SHORT } from "@/features/short/copy";
import { isLiveWindow, opensAt, type ShortKind, type ShortStock } from "@/features/short/useShortWindows";
import { EmptyState, haptic, LoadingState } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { Sparkline } from "~/features/baskets/DeskKit";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { lineOf, nameOfAsset, PriceLine } from "./assets";
import { Clock } from "./Clock";

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

/**
 * web's `features/short/ShortPicker.tsx` + `ShortAssetPicker.tsx`: the filter, every name as a card in a snap row
 * (tradable first while the bell is shut), the chosen name in full once, its cadences, then its Windows — live ones
 * priced from their own Down ask, later ones with the time they open.
 */
export function ShortPicker({ stocks, loading, selected, onSelect, nowMs }: ShortPickerProps) {
  const { color } = useTheme();
  const marks = useDeskMarks();
  const session = useMarketSession();
  const [filter, setFilter] = useState<Filter>("all");
  if (loading) return <LoadingState shape="plate" label={P.loading} />;
  if (stocks.length === 0) return <EmptyState why={P.noneTitle} detail={P.noneBody} />;

  const kinds = FILTER_KINDS[filter];
  const shown = kinds ? stocks.filter((s) => kinds.includes(s.kind)) : stocks;
  const stock = stocks.find((s) => s.windows.some((w) => w.marketId === selected?.marketId)) ?? shown[0] ?? stocks[0];
  if (!stock) return null;
  const cadences = [...new Set(stock.windows.map((w) => w.intervalSec))].sort((a, b) => a - b);
  const cadence = selected && selected.asset === stock.asset ? selected.intervalSec : (cadences[0] ?? 0);
  const windows = stock.windows.filter((w) => w.intervalSec === cadence);
  const counts: Record<Filter, number> = {
    all: stocks.length,
    stock: stocks.filter((s) => s.kind === "stock").length,
    allDay: stocks.filter((s) => s.kind !== "stock").length,
  };
  const live = shown.filter((s) => s.liveCount > 0);
  const later = shown.filter((s) => s.liveCount === 0);
  const split = live.length > 0 && later.length > 0;
  const laterLabel = later.every((s) => s.kind === "stock") && session && !session.open ? P.groupLater(session.label) : P.groupLaterBare;
  const pickAsset = (asset: string) => {
    const next = stocks.find((s) => s.asset === asset)?.windows[0];
    if (next) onSelect(next);
  };

  return (
    <View style={styles.picker}>
      <View style={styles.head}>
        <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{P.stock}</Text>
        <View style={styles.filters} accessibilityRole="tablist" accessibilityLabel={P.filterAria}>
          {(["all", "stock", "allDay"] as const)
            .filter((f) => f === "all" || counts[f] > 0)
            .map((f) => (
              <Toggle key={f} on={filter === f} onPress={() => setFilter(f)} label={`${P.filter[f]} ${counts[f]}`} />
            ))}
        </View>
      </View>

      {split ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{P.groupLive}</Text> : null}
      <AssetRow stocks={split ? live : shown} value={stock.asset} marks={marks} onPick={pickAsset} />
      {split ? <Text style={[TYPE.caption, { color: color.inkMuted }]}>{laterLabel}</Text> : null}
      {split ? <AssetRow stocks={later} value={stock.asset} marks={marks} onPick={pickAsset} /> : null}

      <Summary stock={stock} marks={marks} />

      <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{P.window}</Text>
      <View style={styles.filters} accessibilityLabel={P.cadenceAria}>
        {cadences.map((c) => {
          const first = stock.windows.find((w) => w.intervalSec === c);
          const on = c === cadence;
          const isLive = stock.windows.some((w) => w.intervalSec === c && isLiveWindow(w, nowMs));
          return <Toggle key={c} on={on} live={isLive} onPress={() => first && onSelect(first)} label={formatCadence(c)} />;
        })}
      </View>
      <View style={styles.windows}>
        {windows.map((market) => (
          <WindowRow key={market.marketId} market={market} on={market.marketId === selected?.marketId} onSelect={onSelect} nowMs={nowMs} />
        ))}
      </View>
    </View>
  );
}

function Toggle({ on, onPress, label, live }: { on: boolean; onPress: () => void; label: string; live?: boolean }) {
  const { color } = useTheme();
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      accessibilityLabel={label}
      style={[styles.toggle, { backgroundColor: on ? color.accentWash : color.surface1, borderColor: on ? color.accent : color.hairline }]}
    >
      {live !== undefined ? <View style={[styles.dot, { backgroundColor: live ? color.profit : color.inkDisabled }]} /> : null}
      <Text style={[TYPE.data, { color: on ? color.accent : color.ink }]}>{label}</Text>
    </Pressable>
  );
}

/** web's snap row of name chips (`.sh-chip`): mark, name, cashtag, live dot, price, the week's line. */
function AssetRow({ stocks, value, marks, onPick }: { stocks: ShortStock[]; value: string; marks: DeskMarks | null; onPick: (asset: string) => void }) {
  const { color } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow} accessibilityRole="radiogroup" accessibilityLabel={P.stock}>
      {stocks.map((s) => {
        const on = s.asset === value;
        const line = lineOf(s, marks);
        return (
          <Pressable
            key={s.asset}
            onPress={() => {
              haptic.select();
              onPick(s.asset);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${nameOfAsset(s.asset)}, ${s.liveCount > 0 ? P.liveNow : P.closed}`}
            style={[styles.chip, { backgroundColor: on ? color.accentWash : color.surface1, borderColor: on ? color.accent : color.hairline }]}
          >
            <View style={styles.chipTop}>
              <AssetDisc asset={s.asset} size={26} />
              <View style={styles.chipNames}>
                <Text style={[TYPE.caption, { color: color.ink }]} numberOfLines={1}>
                  {nameOfAsset(s.asset)}
                </Text>
                <Text style={[styles.tag, { color: color.inkMuted }]}>${s.asset}</Text>
              </View>
            </View>
            <View style={styles.chipBottom}>
              <View style={[styles.dot, { backgroundColor: s.liveCount > 0 ? color.profit : color.inkDisabled }]} />
              <PriceLine asset={s.asset} style={styles.chipPrice} />
              {line.length > 1 ? <Sparkline values={line} width={36} height={14} /> : null}
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** web's `ShortPickSummary`: the chosen name in full, once — kind, when it trades, price and week. */
function Summary({ stock, marks }: { stock: ShortStock; marks: DeskMarks | null }) {
  const { color } = useTheme();
  const live = stock.liveCount > 0;
  const next = stock.windows[0];
  const line = lineOf(stock, marks);
  return (
    <View style={[styles.summary, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityLiveRegion="polite">
      <AssetDisc asset={stock.asset} size={40} />
      <View style={styles.summaryText}>
        <Text style={[TYPE.bodyStrong, { color: color.ink }]} numberOfLines={1}>
          {nameOfAsset(stock.asset)}
        </Text>
        <Text style={[TYPE.caption, { color: color.inkMuted }]} numberOfLines={2}>
          ${stock.asset} · {P.kind[stock.kind]} ·{" "}
          <Text style={{ color: live ? color.profit : color.inkSecondary }}>
            {live ? P.liveNow : next ? P.opens(opensAt(next.tradingStartSec)) : P.closed}
          </Text>
        </Text>
      </View>
      <View style={styles.summaryRight}>
        <PriceLine asset={stock.asset} />
        {line.length > 1 ? <Sparkline values={line} width={72} height={22} /> : null}
      </View>
    </View>
  );
}

function WindowRow({ market, on, onSelect, nowMs }: { market: EventMarket; on: boolean; onSelect: (m: EventMarket) => void; nowMs: number }) {
  const { color } = useTheme();
  const live = isLiveWindow(market, nowMs);
  return (
    <Pressable
      onPress={() => {
        haptic.select();
        onSelect(market);
      }}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      accessibilityLabel={`${formatCadence(market.intervalSec)} window`}
      style={[styles.window, { backgroundColor: on ? color.accentWash : color.surface1, borderColor: on ? color.accent : color.hairline }]}
    >
      <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{formatCadence(market.intervalSec)}</Text>
      {live ? <LiveTerms market={market} nowMs={nowMs} /> : <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{P.opens(opensAt(market.tradingStartSec))}</Text>}
    </Pressable>
  );
}

/** A live Window prices itself from the top of its own book: the Down ask, what a dollar of the fall costs now. */
function LiveTerms({ market, nowMs }: { market: EventMarket; nowMs: number }) {
  const { color } = useTheme();
  const { downCents, hydrating } = useTopOfBook(market);
  return (
    <View style={styles.terms}>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>
        <Clock expirySec={market.expirySec} intervalSec={market.intervalSec} nowMs={nowMs} /> {P.left}
      </Text>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>
        {P.costLabel}{" "}
        <Text style={[TYPE.data, { color: color.loss }]}>{hydrating ? P.costPending : downCents === null ? P.noQuotes : P.cost(downCents)}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: 12 },
  head: { gap: 8 },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  toggle: { minHeight: 40, paddingHorizontal: 14, borderRadius: RADIUS.full, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  chipRow: { gap: 8, paddingRight: 8 },
  chip: { width: 148, borderRadius: RADIUS.md, borderWidth: 1, padding: 10, gap: 8 },
  chipTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  chipNames: { flex: 1 },
  tag: { fontFamily: FONT.data, fontSize: 11 },
  chipBottom: { flexDirection: "row", alignItems: "center", gap: 6 },
  chipPrice: { fontSize: 12, flexShrink: 1 },
  summary: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 12 },
  summaryText: { flex: 1, gap: 2 },
  summaryRight: { alignItems: "flex-end", gap: 4 },
  windows: { gap: 8 },
  window: { minHeight: 52, borderRadius: RADIUS.md, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  terms: { alignItems: "flex-end", gap: 2 },
});
