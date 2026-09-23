import { TICKERS, type TickerSymbol } from "@agari/core/market";
import { formatBaseUnits } from "@agari/core/units";
import { useAssetPrice } from "@agari/markets/react";
import { useRouter } from "expo-router";
import { Share, StyleSheet, Text, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { NEWS } from "@/features/news/copy";
import type { Article } from "@/features/news/protocol";
import { useNews } from "@/features/news/useNews";
import { Button, Card, EmptyState, LoadingState, Screen, SectionHeader } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { openExternal } from "~/lib/external";
import { pushToast } from "~/components/toast/store";
import { FONT, TYPE, useTheme } from "~/theme";
import { articleSymbols, metaLine, Tone, toneInk } from "./parts";

/** One stock the story is filed under: its mark, name and the venue's live spot (or "—" before the first read). */
function NamedStock({ symbol, onPress }: { symbol: TickerSymbol; onPress: () => void }) {
  const { color } = useTheme();
  const reading = useAssetPrice(symbol);
  const price = reading?.ok ? reading.value : null;
  const spot = price ? formatBaseUnits(price.priceRaw, price.decimals, { maxDp: 2, minDp: 2 }) : "—";
  return (
    <Card onPress={onPress} accessibilityLabel={`${TICKERS[symbol].name}, ${spot}. Open the ${symbol} hub`}>
      <View style={styles.stock}>
        <AssetDisc asset={symbol} size={36} />
        <View style={styles.stockName}>
          <Text style={[TYPE.bodyStrong, { color: color.ink }]}>{TICKERS[symbol].name}</Text>
          <Text style={[TYPE.data, styles.small, { color: color.accent }]}>${symbol}</Text>
        </View>
        <View style={styles.stockPrice}>
          <Text style={[TYPE.dataLg, { color: color.ink }]}>{spot}</Text>
          <Text style={[TYPE.data, styles.small, { color: reading?.ok && reading.stale ? color.warning : color.inkMuted }]}>
            {reading?.ok && reading.stale ? "last price · aged" : "spot"}
          </Text>
        </View>
      </View>
    </Card>
  );
}

function StoryBody({ article, index }: { article: Article; index: string }) {
  const { color } = useTheme();
  const router = useRouter();
  const symbols = articleSymbols(article.symbols);
  const published = new Date(article.publishedAt);
  const read = () =>
    openExternal(article.url).catch((error: unknown) =>
      pushToast({ tone: "warning", title: "Could not open the story", description: error instanceof Error ? error.message : String(error) }),
    );
  return (
    <>
      <Animated.View entering={FadeInDown.duration(300)} style={[styles.head, { borderLeftColor: toneInk(article.sentiment, color) }]}>
        <View style={styles.metaRow}>
          <Text style={[styles.index, { color: color.accent }]}>{index.padStart(2, "0")}</Text>
          <Tone tone={article.sentiment} />
        </View>
        <Text style={[TYPE.headline, { color: color.ink }]} accessibilityRole="header" selectable>
          {article.title}
        </Text>
        <Text style={[TYPE.data, styles.small, { color: color.inkMuted }]}>{metaLine(article)}</Text>
        <Text style={[TYPE.data, styles.small, { color: color.inkMuted }]}>{published.toLocaleString()}</Text>
      </Animated.View>

      <Button label={`Read at ${article.source}`} icon={{ ios: "safari", android: "open_in_new" }} onPress={() => void read()} size="lg" />
      <Button
        label="Share the story"
        variant="outline"
        icon={{ ios: "square.and.arrow.up", android: "share" }}
        onPress={() => void Share.share({ message: `${article.title} — ${article.url}`, url: article.url })}
      />

      {symbols.length > 0 ? (
        <>
          <SectionHeader index="01" title="On the wire for" desc="The listed stocks this story is filed under, at the venue's live price." />
          {symbols.map((symbol) => (
            <NamedStock key={symbol} symbol={symbol} onPress={() => router.push({ pathname: "/tickers/[symbol]", params: { symbol } })} />
          ))}
        </>
      ) : null}
    </>
  );
}

/**
 * A story from the wire, on its own screen: web links each headline straight out, so the phone shows what the wire
 * carries — tone, time, source, the stocks it names at their live price — and hands the article itself to the browser.
 */
export function StoryScreen({ url, index, symbol }: { url: string; index: string; symbol: TickerSymbol | null }) {
  const router = useRouter();
  const reading = useNews(symbol);
  const article = reading?.ok ? reading.value.find((candidate) => candidate.url === url) : undefined;
  return (
    <Screen title={NEWS.title}>
      {reading === null ? <LoadingState shape="plate" label="Reading the story" /> : null}
      {reading !== null && !article ? (
        <EmptyState
          why="This story has left the wire."
          detail="The wire keeps the newest headlines; this one has rolled off since you opened it."
          action={{ label: "Back to the wire", onPress: () => router.back() }}
        />
      ) : null}
      {article ? <StoryBody article={article} index={index} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 10, borderLeftWidth: 2, paddingLeft: 12 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  index: { fontFamily: FONT.dataStrong, fontSize: 12, letterSpacing: 0.6 },
  small: { fontSize: 12 },
  stock: { flexDirection: "row", alignItems: "center", gap: 12 },
  stockName: { flex: 1, gap: 2 },
  stockPrice: { alignItems: "flex-end", gap: 2 },
});
