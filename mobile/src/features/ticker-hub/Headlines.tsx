import { isTickerSymbol, type TickerSymbol } from "@agari/core/market";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { NEWS } from "@/features/news/copy";
import type { Article } from "@/features/news/protocol";
import { haptic } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { openExternal } from "~/lib/external";
import { FONT, TYPE, useTheme } from "~/theme";

/** web's `ROW_SYMBOLS_MAX`: the most marks and cashtags one row carries. */
const ROW_SYMBOLS_MAX = 4;
const symbolsOf = (symbols: readonly string[] | undefined): TickerSymbol[] => [...new Set((symbols ?? []).filter(isTickerSymbol))].slice(0, ROW_SYMBOLS_MAX);

/**
 * The ticker's headlines in the wire's row grammar — web's `Headlines` / `NewsRow` (D-082): number, the marks of every
 * stock the story names, the headline (the publisher's page, outside the app), then age · source, its cashtags (each
 * a link to its hub) and the sentiment word in its tone.
 */
export function Headlines({ articles }: { articles: readonly Article[] }) {
  const { color } = useTheme();
  const toneInk = { positive: color.profit, negative: color.loss, neutral: color.inkSecondary } as const;
  return (
    <View>
      {articles.map((article, i) => {
        const symbols = symbolsOf(article.symbols);
        return (
          <View key={article.url} style={[styles.row, { borderBottomColor: color.hairline }]}>
            <Text style={[styles.index, { color: color.inkMuted }]}>{String(i + 1).padStart(2, "0")}</Text>
            <View style={styles.marks}>
              {symbols.slice(0, 2).map((symbol, n) => (
                <View key={symbol} style={n > 0 ? styles.overlap : undefined}>
                  <AssetDisc asset={symbol} size={24} />
                </View>
              ))}
            </View>
            <View style={styles.text}>
              <Pressable
                onPress={() => {
                  haptic.tap();
                  void openExternal(article.url);
                }}
                accessibilityRole="link"
                accessibilityLabel={`${article.title}, ${article.source}`}
                hitSlop={4}
              >
                <Text style={[TYPE.bodyStrong, { color: color.ink }]} numberOfLines={3}>
                  {article.title}
                </Text>
              </Pressable>
              <View style={styles.meta}>
                <Text style={[styles.metaText, { color: color.inkMuted }]}>
                  {NEWS.timeAgo(new Date(article.publishedAt).getTime())} · {article.source}
                </Text>
                {symbols.map((symbol) => (
                  <Pressable
                    key={symbol}
                    onPress={() => {
                      haptic.tap();
                      router.push(`/tickers/${symbol}`);
                    }}
                    accessibilityRole="link"
                    accessibilityLabel={`Open ${symbol}`}
                    hitSlop={8}
                  >
                    <Text style={[styles.metaText, { color: color.accent }]}>${symbol}</Text>
                  </Pressable>
                ))}
                <Text style={[styles.tone, { color: toneInk[article.sentiment] }]}>{NEWS.sentiment[article.sentiment]}</Text>
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  index: { fontFamily: FONT.data, fontSize: 11, width: 20, paddingTop: 5 },
  marks: { flexDirection: "row", width: 36, paddingTop: 2 },
  overlap: { marginLeft: -12 },
  text: { flex: 1, gap: 4 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  metaText: { fontFamily: FONT.data, fontSize: 12 },
  tone: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 0.8, textTransform: "uppercase", marginLeft: "auto" },
});
