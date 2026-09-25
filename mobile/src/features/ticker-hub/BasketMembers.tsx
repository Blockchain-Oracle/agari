import { TICKERS, type Basket } from "@agari/core/market";
import { router } from "expo-router";
import { ScrollView, StyleSheet, Text, View, type TextStyle } from "react-native";
import { usdLine } from "@/features/markets/hero/units";
import { TICKER_HUB } from "@/features/ticker-hub/copy";
import type { BasketMemberView } from "@/features/ticker-hub/usePreIpoFacts";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, useTheme } from "~/theme";

const signedPct = (bps: number): string => `${bps > 0 ? "+" : bps < 0 ? "−" : ""}${(Math.abs(bps) / 100).toFixed(1)}%`;

/** The columns as web lays the table out at 402 px (min-width 440, content 541): Company · Weight · Token price · Since base · You hold. */
const COLS = [207, 61, 98, 91, 84] as const;

interface BasketMembersProps {
  basket: Basket;
  /** The members' prices and moves from the feed's row; null before it answers (weights still show). */
  members: readonly BasketMemberView[] | null;
  /** Members this wallet holds; null with no wallet connected (the column then reads "—"). */
  held: ReadonlySet<string> | null;
}

/**
 * web's `BasketMembers` (ticker-hub.css `.tkh-members-scroll`): the table in its own rounded frame on the card surface,
 * scrolling sideways on a phone. Each company's mark, name and cashtag (its own hub), its weight, token price, move
 * since base and whether the wallet holds it. Production resolves none of the table's ink variables, so every cell
 * reads in the page ink with no row rules, as it does there.
 */
export function BasketMembers({ basket, members, held }: BasketMembersProps) {
  const { color } = useTheme();
  const T = TICKER_HUB.basket.table;
  const ink = { color: color.ink };
  const cell = (i: number, last = false): TextStyle[] => [styles.cell, { width: COLS[i] }, i === 0 ? styles.first : styles.num, last ? styles.last : {}];
  return (
    <View style={[styles.frame, { backgroundColor: color.surface1, borderColor: color.hairline }]} accessibilityLabel={T.title}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View>
          <View style={styles.headRow}>
            {[T.member, T.weight, T.price, T.sinceBase, T.held].map((label, i) => (
              <Text key={label} style={[...cell(i, i === 4), styles.th, ink]}>
                {label}
              </Text>
            ))}
          </View>
          {basket.members.map((m) => {
            const row = members?.find((r) => r.symbol === m.symbol) ?? null;
            const move = row?.moveBps ?? null;
            const holds = held?.has(m.symbol) ?? null;
            return (
              <View key={m.symbol} style={styles.row}>
                <View style={[styles.cell, styles.first, styles.member, { width: COLS[0] }]}>
                  <AssetDisc asset={m.symbol} size={24} />
                  <Text style={[styles.td, ink]} numberOfLines={1}>
                    <Text style={styles.name}>{TICKERS[m.symbol].name}</Text>
                    <Text
                      style={[styles.tag, { color: color.accent }]}
                      accessibilityRole="link"
                      onPress={() => router.push({ pathname: "/tickers/[symbol]", params: { symbol: m.symbol } })}
                    >
                      {` $${m.symbol}`}
                    </Text>
                  </Text>
                </View>
                <Text style={[...cell(1), styles.td, ink]}>{`${(m.weightBps / 100).toFixed(m.weightBps % 100 === 0 ? 0 : 1)}%`}</Text>
                <Text style={[...cell(2), styles.td, ink]}>{row ? usdLine(row.tokenPriceE8) : TICKER_HUB.dash}</Text>
                <Text style={[...cell(3), styles.td, ink]}>{move === null ? TICKER_HUB.dash : signedPct(move)}</Text>
                <Text style={[...cell(4, true), styles.td, ink]}>{holds === null ? TICKER_HUB.dash : holds ? T.yes : T.no}</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { marginTop: 24, borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  headRow: { flexDirection: "row", height: 38 },
  row: { flexDirection: "row", height: 51, alignItems: "center" },
  cell: { paddingVertical: 10, paddingHorizontal: 8 },
  first: { paddingLeft: 16, textAlign: "left" },
  num: { textAlign: "right" },
  last: { paddingRight: 16 },
  member: { flexDirection: "row", alignItems: "center", gap: 10 },
  th: { fontFamily: FONT.data, fontSize: 11, lineHeight: 17.6, letterSpacing: 0.88, textTransform: "uppercase" },
  td: { fontFamily: FONT.body, fontSize: 15, lineHeight: 24, fontVariant: ["tabular-nums"], flexShrink: 1 },
  name: { fontFamily: FONT.bodyStrong },
  tag: { fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
});
