import { isTickerSymbol, type TickerSymbol } from "@agari/core/market";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { NEWS } from "@/features/news/copy";
import type { Article, Sentiment } from "@/features/news/protocol";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { pushToast } from "~/components/toast/store";
import { openExternal } from "~/lib/external";
import { FONT, useTheme, type Palette } from "~/theme";

/** web NewsRow.tsx ROW_SYMBOLS_MAX: a wire story rarely names more than two registry tickers. */
const ROW_SYMBOLS_MAX = 4;

/** web NewsRow.tsx `articleSymbols`: registry tickers, deduped, capped. */
export function articleSymbols(symbols: readonly string[] | undefined): TickerSymbol[] {
  return [...new Set((symbols ?? []).filter(isTickerSymbol))].slice(0, ROW_SYMBOLS_MAX);
}

/** news.css `data-tone`: bullish profit, bearish loss, neutral gray-500. */
export function toneInk(tone: Sentiment, color: Palette): string {
  if (tone === "positive") return color.profit;
  if (tone === "negative") return color.loss;
  return color.inkMuted;
}

/** web links every headline straight out to its source; the app hands it to the in-app browser the same way. */
export function openArticle(url: string) {
  openExternal(url).catch((error: unknown) =>
    pushToast({ tone: "warning", title: "Could not open the story", description: error instanceof Error ? error.message : String(error) }),
  );
}

/** web NewsFeed.tsx `Meta`: "5m · Reuters" in 10 px mono gray-600. */
export function Meta({ article }: { article: Article }) {
  const { color } = useTheme();
  return (
    <Text style={[styles.meta, { color: color.inkDisabled }]}>
      {NEWS.timeAgo(new Date(article.publishedAt).getTime())} · {article.source}
    </Text>
  );
}

/** web NewsRow.tsx `Tone`: the sentiment as a dot and a word, never a number. */
export function Tone({ tone }: { tone: Sentiment }) {
  const { color } = useTheme();
  const ink = toneInk(tone, color);
  return (
    <View style={styles.tone}>
      <View style={[styles.toneDot, { backgroundColor: ink }]} />
      <Text style={[styles.toneWord, { color: ink }]}>{NEWS.sentiment[tone]}</Text>
    </View>
  );
}

/** web NewsRow.tsx `MarkCluster`: discs ringed 1.5 px in the ground, each overlapping the last by 5 px. */
export function MarkCluster({ symbols, size = 16 }: { symbols: readonly TickerSymbol[]; size?: number }) {
  const { color } = useTheme();
  if (symbols.length === 0) return null;
  return (
    <View style={styles.cluster} accessible={false}>
      {symbols.map((symbol, index) => (
        <View
          key={symbol}
          style={[styles.ring, { marginLeft: index === 0 ? -1.5 : -6.5, borderColor: color.ground, borderRadius: size }]}
        >
          <AssetDisc asset={symbol} size={size} />
        </View>
      ))}
    </View>
  );
}

/** web NewsRow.tsx `Cashtags`: `$TSLA $NVDA`, each opening its ticker hub. */
export function Cashtags({ symbols }: { symbols: readonly TickerSymbol[] }) {
  const { color } = useTheme();
  if (symbols.length === 0) return null;
  return (
    <View style={styles.cashtags}>
      {symbols.map((symbol) => (
        <Text
          key={symbol}
          style={[styles.cashtag, { color: color.inkMuted }]}
          accessibilityRole="link"
          onPress={() => router.push({ pathname: "/tickers/[symbol]", params: { symbol } })}
        >
          ${symbol}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  meta: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16 },
  tone: { flexDirection: "row", alignItems: "center", gap: 6 },
  toneDot: { width: 6, height: 6, borderRadius: 3 },
  toneWord: { fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 1.26, textTransform: "uppercase" },
  cluster: { flexDirection: "row", alignItems: "center", marginVertical: -1.5 },
  ring: { borderWidth: 1.5 },
  cashtags: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  cashtag: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 0.8 },
});
