import { isTickerSymbol, type TickerSymbol } from "@agari/core/market";
import { StyleSheet, Text, View } from "react-native";
import { NEWS } from "@/features/news/copy";
import type { Article, Sentiment } from "@/features/news/protocol";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { FONT, TYPE, useTheme, type Palette } from "~/theme";

/** web NewsRow.tsx ROW_SYMBOLS_MAX: a wire story rarely names more than two registry tickers. */
const ROW_SYMBOLS_MAX = 4;

/** web NewsRow.tsx `articleSymbols` (redrawn here because that file renders DOM): registry tickers, deduped, capped. */
export function articleSymbols(symbols: readonly string[] | undefined): TickerSymbol[] {
  return [...new Set((symbols ?? []).filter(isTickerSymbol))].slice(0, ROW_SYMBOLS_MAX);
}

/** The ink a sentiment is drawn in: bullish profit, bearish loss, neutral muted (web news.css `data-tone`). */
export function toneInk(tone: Sentiment, color: Palette): string {
  if (tone === "positive") return color.profit;
  if (tone === "negative") return color.loss;
  return color.inkMuted;
}

/** "5m · Reuters" — web NewsFeed.tsx `Meta`. */
export function metaLine(article: Article): string {
  return `${NEWS.timeAgo(new Date(article.publishedAt).getTime())} · ${article.source}`;
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

/** web NewsRow.tsx `MarkCluster`: the named stocks' discs, overlapping like a byline of faces. */
export function MarkCluster({ symbols, size = 22 }: { symbols: readonly TickerSymbol[]; size?: number }) {
  const { color } = useTheme();
  if (symbols.length === 0) return null;
  return (
    <View style={styles.cluster} accessible={false}>
      {symbols.map((symbol, index) => (
        <View
          key={symbol}
          style={[
            styles.clusterItem,
            { marginLeft: index === 0 ? 0 : -size / 3, borderColor: color.ground, borderRadius: size },
          ]}
        >
          <AssetDisc asset={symbol} size={size} />
        </View>
      ))}
    </View>
  );
}

/** web NewsRow.tsx `Cashtags`: `$TSLA $NVDA` in mono. */
export function Cashtags({ symbols }: { symbols: readonly TickerSymbol[] }) {
  const { color } = useTheme();
  if (symbols.length === 0) return null;
  return <Text style={[TYPE.data, styles.cashtags, { color: color.accent }]}>{symbols.map((s) => `$${s}`).join(" ")}</Text>;
}

const styles = StyleSheet.create({
  tone: { flexDirection: "row", alignItems: "center", gap: 6 },
  toneDot: { width: 6, height: 6, borderRadius: 3 },
  toneWord: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.2, textTransform: "uppercase" },
  cluster: { flexDirection: "row", alignItems: "center" },
  clusterItem: { borderWidth: 2 },
  cashtags: { fontSize: 12 },
});
