import { TICKERS, type Basket } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BASKETS_COPY } from "@/features/baskets/copy";
import { bpsPct, windowText } from "@/features/hedge/calm";
import { pointsLine } from "@/features/markets/hero/units";
import { laneTabLabel } from "@/features/markets/lanes/lane-view";
import type { PreIpoMove } from "@/features/ticker-hub/usePreIpoFacts";
import { haptic, Skeleton } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { Clock } from "~/features/short/Clock";
import { FONT, RADIUS, TYPE, useTheme } from "~/theme";
import { LogoStack, Sparkline } from "./DeskKit";

const C = BASKETS_COPY.card;

/** The ticker hub and the desk studio are other builders' routes; typed routes learn them once those files land. */
const route = (path: string): Href => path as Href;

export interface BasketCardProps {
  basket: Basket;
  /** The live index at the print scale (points × 10⁸), null before the first read. */
  indexRaw: bigint | null;
  move: PreIpoMove | null;
  window: EventMarket | null;
  /** Top of the Window's book; null while it hydrates or when no Window trades. */
  book: { upCents: number | null; downCents: number | null } | null;
  nowMs: number;
  /** Members this wallet holds; null with no wallet connected. */
  heldCount: number | null;
  coverable: boolean;
  /** The basket's hourly index over the last week, oldest first. */
  line: readonly number[];
}

/**
 * web's `features/baskets/BasketCard.tsx`: the header with its cashtag (into the ticker hub), the members' marks,
 * the index with its week, the live Window row with its book, then Predict · Cover · Hold and why Cover is or is
 * not open. Every row keeps its height whatever arrives, so a read landing never moves the card.
 */
export function BasketCard({ basket, indexRaw, move, window, book, nowMs, heldCount, coverable, line }: BasketCardProps) {
  const { color } = useTheme();
  const memberSymbols = basket.members.map((m) => m.symbol);
  const names = basket.members.map((m) => TICKERS[m.symbol].name);
  const coverWhy =
    heldCount === null
      ? C.coverWhy.connect
      : !window
        ? C.coverWhy.noWindow
        : !coverable
          ? C.coverWhy.needsTwo(heldCount)
          : C.coverWhy.ready(heldCount, basket.members.length);
  const quoted = book !== null && (book.upCents !== null || book.downCents !== null);
  const first = line[0];
  const weekMove = line.length >= 2 && first ? Math.round((((line.at(-1) ?? 0) - first) / first) * 10_000) : null;
  const weekInk = weekMove === null || weekMove === 0 ? color.inkMuted : weekMove > 0 ? color.profit : color.loss;
  const weekSign = weekMove === null ? "" : weekMove > 0 ? "+" : weekMove < 0 ? "−" : "";
  const hub = () => router.push(route(`/tickers/${basket.symbol}`));

  return (
    <View
      style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]}
      accessibilityLabel={C.aria(basket.name)}
    >
      <Pressable onPress={hub} accessibilityRole="link" accessibilityLabel={`${basket.name}, open $${basket.symbol}`} style={styles.head}>
        <AssetDisc asset={basket.symbol} size={44} />
        <View style={styles.title}>
          <Text style={[TYPE.title, { color: color.ink }]}>{basket.name}</Text>
          <Text style={[TYPE.data, { color: color.accent }]}>${basket.symbol}</Text>
        </View>
      </Pressable>
      <Text style={[TYPE.caption, { color: color.inkSecondary }]}>{basket.blurb}</Text>

      <View style={styles.members}>
        <LogoStack symbols={memberSymbols} names={names} max={5} />
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{C.count(basket.members.length)}</Text>
      </View>

      <View style={[styles.index, { borderColor: color.hairline }]}>
        <View style={styles.indexFigures}>
          <Text style={[TYPE.labelMicro, { color: color.inkMuted }]}>{C.index}</Text>
          {indexRaw === null ? (
            <Skeleton width={120} height={24} />
          ) : (
            <Text style={[TYPE.dataLg, { color: color.ink }]}>{pointsLine(indexRaw)}</Text>
          )}
          <Text style={[TYPE.caption, { color: color.inkMuted }]} numberOfLines={2}>
            {move ? C.moved(bpsPct(move.rangeBps), windowText(move.windowSec)) : C.quiet}
          </Text>
        </View>
        <View style={styles.week}>
          <Sparkline values={line} width={104} height={40} />
          <Text style={[styles.weekText, { color: weekInk }]}>
            {weekMove === null ? C.weekNone : C.week(`${weekSign}${bpsPct(Math.abs(weekMove))}`)}
          </Text>
        </View>
      </View>

      <WindowRow window={window} book={book} quoted={quoted} nowMs={nowMs} />

      <View style={styles.actions}>
        <Action
          label={C.predict}
          kind="predict"
          onPress={() => (window ? router.push(`/markets/${window.marketId}`) : hub())}
        />
        <Action
          label={C.cover}
          kind="cover"
          disabled={!(window && coverable)}
          hint={coverWhy}
          onPress={() => window && router.push(`/markets/${window.marketId}?dir=down`)}
        />
        <Action
          label={C.hold}
          kind="hold"
          hint={C.holdWhy}
          onPress={() => router.push(route(`/desk/new?basket=${basket.symbol}`))}
        />
      </View>
      <Text style={[TYPE.caption, { color: color.inkMuted }]}>{coverWhy}</Text>
    </View>
  );
}

/** The Window line: live dot, cadence and clock, then the book's Up and Down asks, or why there are none. */
function WindowRow({ window, book, quoted, nowMs }: { window: EventMarket | null; book: BasketCardProps["book"]; quoted: boolean; nowMs: number }) {
  const { color } = useTheme();
  if (!window) {
    return (
      <View style={[styles.window, { backgroundColor: color.surface2 }]}>
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{C.noWindow}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.window, { backgroundColor: color.surface2 }]}>
      <View style={styles.windowLabel}>
        <View style={[styles.liveDot, { backgroundColor: color.profit }]} />
        <Text style={[TYPE.caption, { color: color.ink }]}>{C.window(laneTabLabel(window.lane, window.intervalSec))}</Text>
        <Clock expirySec={window.expirySec} intervalSec={window.intervalSec} nowMs={nowMs} />
      </View>
      {book === null ? (
        <Skeleton width={96} height={16} />
      ) : quoted ? (
        <View style={styles.book}>
          <Text style={[TYPE.caption, { color: color.profit }]}>
            {C.up} <Text style={styles.cents}>{book.upCents === null ? C.unquoted : `${book.upCents}¢`}</Text>
          </Text>
          <Text style={[TYPE.caption, { color: color.loss }]}>
            {C.down} <Text style={styles.cents}>{book.downCents === null ? C.unquoted : `${book.downCents}¢`}</Text>
          </Text>
        </View>
      ) : (
        <Text style={[TYPE.caption, { color: color.inkMuted }]}>{C.noQuotes}</Text>
      )}
    </View>
  );
}

function Action({ label, kind, onPress, disabled, hint }: { label: string; kind: "predict" | "cover" | "hold"; onPress: () => void; disabled?: boolean; hint?: string }) {
  const { color } = useTheme();
  const primary = kind === "predict";
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: primary ? color.accent : color.surface2,
          borderColor: primary ? color.accent : color.hairline,
          opacity: disabled ? 0.4 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[styles.actionText, { color: primary ? color.onAccent : color.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.lg, borderWidth: StyleSheet.hairlineWidth, padding: 16, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 },
  title: { flex: 1, gap: 2 },
  members: { flexDirection: "row", alignItems: "center", gap: 10 },
  index: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  indexFigures: { flex: 1, gap: 4 },
  week: { alignItems: "flex-end", gap: 4 },
  weekText: { fontFamily: FONT.data, fontSize: 11 },
  window: { borderRadius: RADIUS.md, padding: 10, gap: 6, minHeight: 58, justifyContent: "center" },
  windowLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  book: { flexDirection: "row", gap: 16 },
  cents: { fontFamily: FONT.dataStrong },
  actions: { flexDirection: "row", gap: 8 },
  action: { flex: 1, minHeight: 44, borderRadius: RADIUS.md, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  actionText: { fontFamily: FONT.bodyStrong, fontSize: 15 },
});
