import { TICKERS, type Basket } from "@agari/core/market";
import type { EventMarket } from "@agari/core/types";
import { router, type Href } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BASKETS_COPY } from "@/features/baskets/copy";
import { bpsPct, windowText } from "@/features/hedge/calm";
import { pointsLine } from "@/features/markets/hero/units";
import { laneTabLabel } from "@/features/markets/lanes/lane-view";
import type { PreIpoMove } from "@/features/ticker-hub/usePreIpoFacts";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { Clock } from "~/features/short/Clock";
import { FONT, useTheme } from "~/theme";
import { basketsShortTokens } from "~/theme/web/products/baskets-short";
import { LogoStack, Shimmer, Sparkline } from "./DeskKit";

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
  /** The basket's hourly index over the last week, oldest first; empty before the marks load. */
  line: readonly number[];
}

/**
 * web's `features/baskets/BasketCard.tsx` + `baskets.css` at ≤ 480 px: the header with its cashtag (into the ticker
 * hub), the blurb held to two lines, the members' marks, the index with its week, the 44 px Window row, then
 * Predict · Cover · Hold and why Cover is or is not open. Every row keeps its height whatever arrives.
 */
export function BasketCard({ basket, indexRaw, move, window, book, nowMs, heldCount, coverable, line }: BasketCardProps) {
  const { color } = useTheme();
  const memberSymbols = basket.members.map((m) => m.symbol);
  const names = basket.members.map((m) => TICKERS[m.symbol].name);
  const coverWhy =
    heldCount === null ? C.coverWhy.connect : !window ? C.coverWhy.noWindow : !coverable ? C.coverWhy.needsTwo(heldCount) : C.coverWhy.ready(heldCount, basket.members.length);
  const first = line[0];
  const weekMove = line.length >= 2 && first ? Math.round((((line.at(-1) ?? 0) - first) / first) * 10_000) : null;
  const weekInk = weekMove === null || weekMove === 0 ? color.inkMuted : weekMove > 0 ? color.profit : color.loss;
  const weekSign = weekMove === null ? "" : weekMove > 0 ? "+" : weekMove < 0 ? "−" : "";
  const hub = () => router.push(route(`/tickers/${basket.symbol}`));

  return (
    <View style={[styles.card, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityLabel={C.aria(basket.name)}>
      <View style={styles.head}>
        <AssetDisc asset={basket.symbol} size={48} />
        <View style={styles.title}>
          <Text style={[styles.name, { color: color.ink }]} numberOfLines={1}>
            {basket.name}
          </Text>
          <Pressable onPress={hub} accessibilityRole="link" hitSlop={8} style={styles.cashtagHit}>
            <Text style={[styles.cashtag, { color: color.accent }]}>${basket.symbol}</Text>
          </Pressable>
        </View>
      </View>
      <Text style={[styles.blurb, { color: color.inkSecondary }]} numberOfLines={2}>
        {basket.blurb}
      </Text>

      <View style={styles.members}>
        <LogoStack symbols={memberSymbols} names={names} max={5} size={20} />
        <Text style={[styles.membersText, { color: color.inkMuted }]} numberOfLines={1}>
          {C.count(basket.members.length)}
        </Text>
      </View>

      <View style={[styles.index, { backgroundColor: color.surface2 }]}>
        <View style={styles.figures}>
          <Text style={[styles.indexLabel, { color: color.inkMuted }]}>{C.index}</Text>
          {indexRaw === null ? (
            <Shimmer width={140} height={29} label={C.loading} />
          ) : (
            <Text style={[styles.indexValue, { color: color.ink }]} numberOfLines={1}>
              {pointsLine(indexRaw)}
            </Text>
          )}
          <Text style={[styles.indexMove, { color: color.inkSecondary }]} numberOfLines={1}>
            {move ? C.moved(bpsPct(move.rangeBps), windowText(move.windowSec)) : C.quiet}
          </Text>
        </View>
        <View style={styles.week}>
          <Sparkline values={line} width={120} height={40} boxWidth={88} />
          <Text style={[styles.weekLabel, { color: weekInk }]}>
            {weekMove === null ? C.weekNone : C.week(`${weekSign}${bpsPct(Math.abs(weekMove))}`)}
          </Text>
        </View>
      </View>

      <WindowRow window={window} book={book} nowMs={nowMs} />

      <View style={styles.actions}>
        <Action label={C.predict} kind="predict" onPress={() => (window ? router.push(`/markets/${window.marketId}`) : hub())} />
        <Action label={C.cover} kind="cover" off={!(window && coverable)} hint={coverWhy} onPress={() => window && router.push(`/markets/${window.marketId}?dir=down`)} />
        <Action label={C.hold} kind="hold" hint={C.holdWhy} onPress={() => router.push(route(`/desk/new?basket=${basket.symbol}`))} />
      </View>
      <Text style={[styles.why, { color: color.inkMuted }]} numberOfLines={1}>
        {coverWhy}
      </Text>
    </View>
  );
}

/** `.bk-window`: live dot, cadence and clock, then the book's Up and Down asks — or why there are none. */
function WindowRow({ window, book, nowMs }: { window: EventMarket | null; book: BasketCardProps["book"]; nowMs: number }) {
  const { color } = useTheme();
  if (!window) {
    return (
      <View style={[styles.window, styles.windowNone, { borderColor: color.hairline }]}>
        <Text style={[styles.windowQuiet, { color: color.inkMuted }]}>{C.noWindow}</Text>
      </View>
    );
  }
  const quoted = book !== null && (book.upCents !== null || book.downCents !== null);
  return (
    <View style={[styles.window, { borderColor: color.hairline }]}>
      <View style={styles.windowLabel}>
        <View style={[styles.liveDot, { backgroundColor: color.profit, boxShadow: `0px 0px 0px 3px ${color.profitWash}` }]} />
        <Text style={[styles.windowText, { color: color.inkSecondary }]} numberOfLines={1}>
          {C.window(laneTabLabel(window.lane, window.intervalSec))}
        </Text>
        <Clock expirySec={window.expirySec} intervalSec={window.intervalSec} nowMs={nowMs} style={[styles.clock, { color: color.ink }]} />
      </View>
      {book === null ? (
        <Shimmer width={110} height={16} label={C.loading} />
      ) : quoted ? (
        <View style={styles.book}>
          <Text style={[styles.windowText, { color: color.inkSecondary }]}>
            {C.up} <Text style={[styles.cents, { color: color.profit }]}>{book.upCents === null ? C.unquoted : `${book.upCents}¢`}</Text>
          </Text>
          <Text style={[styles.windowText, { color: color.inkSecondary }]}>
            {C.down} <Text style={[styles.cents, { color: color.loss }]}>{book.downCents === null ? C.unquoted : `${book.downCents}¢`}</Text>
          </Text>
        </View>
      ) : (
        <Text style={[styles.windowQuiet, { color: color.inkMuted }]}>{C.noQuotes}</Text>
      )}
    </View>
  );
}

/** `.bk-action`: a 42 px pill in Sora 13 — Predict filled vermilion, Cover ringed in the loss ink (45% while off), Hold ringed muted. */
function Action({ label, kind, onPress, off, hint }: { label: string; kind: "predict" | "cover" | "hold"; onPress: () => void; off?: boolean; hint?: string }) {
  const { color, name } = useTheme();
  const t = basketsShortTokens(name);
  const border = kind === "predict" ? color.accent : kind === "cover" ? t.coverBorder : color.inkMuted;
  return (
    <Pressable
      onPress={() => {
        haptic.tap();
        onPress();
      }}
      disabled={off}
      accessibilityRole={off ? "text" : "link"}
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!off }}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: kind === "predict" ? color.accent : "transparent",
          borderColor: pressed && kind !== "predict" ? color.ink : border,
          opacity: off ? 0.45 : 1,
          transform: [{ translateY: pressed ? -1 : 0 }],
        },
      ]}
    >
      <Text style={[styles.actionText, { color: kind === "predict" ? color.onAccent : color.ink }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, padding: 16, borderWidth: 1, borderRadius: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 14 },
  title: { flexShrink: 1, gap: 2 },
  name: { fontFamily: FONT.headingHeavy, fontSize: 20, lineHeight: 24, letterSpacing: -0.2 },
  cashtagHit: { alignSelf: "flex-start" },
  cashtag: { fontFamily: FONT.data, fontSize: 12.5, lineHeight: 20 },
  blurb: { height: 38, fontFamily: FONT.body, fontSize: 13, lineHeight: 18.85 },
  members: { flexDirection: "row", alignItems: "center", gap: 10 },
  membersText: { flexShrink: 1, fontFamily: FONT.body, fontSize: 12, lineHeight: 19.2 },
  index: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12 },
  figures: { flexShrink: 1, gap: 4 },
  indexLabel: { fontFamily: FONT.dataRegular, fontSize: 10.5, lineHeight: 16.8, letterSpacing: 1.26, textTransform: "uppercase" },
  indexValue: { fontFamily: FONT.heading, fontSize: 22, lineHeight: 24.2, letterSpacing: -0.44, fontVariant: ["tabular-nums"] },
  indexMove: { fontFamily: FONT.body, fontSize: 12, lineHeight: 16.8 },
  week: { flexShrink: 0, alignItems: "flex-end", gap: 4 },
  weekLabel: { fontFamily: FONT.dataRegular, fontSize: 11, lineHeight: 17.6 },
  window: { height: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 12, borderWidth: 1, borderRadius: 12 },
  windowNone: { justifyContent: "center", borderStyle: "dashed" },
  windowLabel: { flexShrink: 1, flexDirection: "row", alignItems: "center", gap: 6, overflow: "hidden" },
  liveDot: { width: 7, height: 7, borderRadius: 3.5 },
  windowText: { flexShrink: 1, fontFamily: FONT.body, fontSize: 13, lineHeight: 20.8 },
  clock: { fontFamily: FONT.dataRegular, fontSize: 13, lineHeight: 20.8 },
  book: { flexShrink: 0, flexDirection: "row", gap: 14 },
  cents: { fontFamily: FONT.bodyStrong, fontVariant: ["tabular-nums"] },
  windowQuiet: { fontFamily: FONT.body, fontSize: 12.5, lineHeight: 20 },
  actions: { flexDirection: "row", gap: 8 },
  action: { flex: 1, minHeight: 42, borderRadius: 9999, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  actionText: { fontFamily: FONT.heading, fontSize: 13, lineHeight: 20.8, letterSpacing: 0.26 },
  why: { fontFamily: FONT.body, fontSize: 12, lineHeight: 18 },
});
