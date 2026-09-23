import type { TickerSymbol } from "@agari/core/market";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { NEWS } from "@/features/news/copy";
import type { Article } from "@/features/news/protocol";
import { NEWS_KEY, useNews } from "@/features/news/useNews";
import { EmptyState, ErrorState, Screen, Skeleton } from "~/components/kit";
import { FONT, TYPE, useTheme } from "~/theme";
import { NewsFilters, type ToneFilter } from "./Filters";
import { LeadStory, WireRow } from "./Wire";

/** web NewsScreen.tsx's "Updated live" chip: a breathing vermilion dot, still under Reduce Motion. */
function LiveChip() {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!reduce) pulse.value = withRepeat(withTiming(0.3, { duration: 1100 }), -1, true);
  }, [reduce, pulse]);
  const dot = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={styles.live}>
      <Animated.View style={[styles.liveDot, { backgroundColor: color.accent }, dot]} />
      <Text style={[styles.liveText, { color: color.inkSecondary }]}>{NEWS.live.toUpperCase()}</Text>
    </View>
  );
}

/** web NewsHead.tsx: "Market News" (or the ticker's), the Japanese line, the intro with the Finnhub credit. */
function NewsHead({ symbol }: { symbol: TickerSymbol | null }) {
  const { color } = useTheme();
  return (
    <View style={styles.head}>
      <Text style={[TYPE.display, { color: color.ink }]} accessibilityRole="header">
        {symbol ?? NEWS.heading} <Text style={{ color: color.accent }}>{NEWS.headingAccent}</Text>
      </Text>
      <Text style={[styles.jp, { color: color.inkMuted }]}>{NEWS.headingJp}</Text>
      <Text style={[TYPE.body, { color: color.inkSecondary }]}>{NEWS.intro}</Text>
    </View>
  );
}

/** The reference keeps its last headlines when a refresh fails, and says so. */
function StaleNote() {
  const { color } = useTheme();
  return <Text style={[TYPE.caption, { color: color.warning }]}>Showing the last good read; the latest refresh failed.</Text>;
}

/** web NewsFeed.tsx `NewsSkeleton`: a display-size lead and five wire lines. */
function NewsSkeleton() {
  return (
    <View style={styles.skeleton} accessibilityRole="progressbar" accessibilityLabel="Reading the wire">
      <Skeleton width="30%" height={12} />
      <Skeleton height={26} />
      <Skeleton width="70%" height={26} />
      {["85%", "76%", "67%", "58%", "49%"].map((width) => (
        <Skeleton key={width} width={width as `${number}%`} height={14} />
      ))}
    </View>
  );
}

/**
 * `/news` — web features/news: the live wire (polled each minute, same key and route as web), a lead story and
 * numbered rows, narrowed to one ticker like `/news?symbol=`; every story opens its own screen.
 */
export function NewsScreen({ initialSymbol }: { initialSymbol: TickerSymbol | null }) {
  const router = useRouter();
  const client = useQueryClient();
  const [symbol, setSymbol] = useState<TickerSymbol | null>(initialSymbol);
  const [tone, setTone] = useState<ToneFilter>("all");
  const reading = useNews(symbol);

  const open = (article: Article, index: number) =>
    router.push({ pathname: "/news/[id]", params: { id: String(index), url: article.url, symbol: symbol ?? "" } });

  const body = () => {
    if (reading === null) return <NewsSkeleton />;
    if (!reading.ok) return <ErrorState diagnosis={reading.error} retry={() => void client.invalidateQueries({ queryKey: NEWS_KEY })} />;
    const articles = reading.value.filter((article) => tone === "all" || article.sentiment === tone);
    if (reading.value.length === 0) return <EmptyState why={NEWS.quiet} />;
    if (articles.length === 0) {
      return <EmptyState why={`No ${NEWS.sentiment[tone as Exclude<ToneFilter, "all">]} headlines on the wire right now.`} action={{ label: "Show every tone", onPress: () => setTone("all") }} />;
    }
    const [lead, ...rest] = articles as [Article, ...Article[]];
    return (
      <View style={styles.feed}>
        <LeadStory article={lead} onOpen={() => open(lead, 1)} />
        <View>
          {rest.map((article, i) => (
            <WireRow key={article.url} article={article} index={i + 2} onOpen={() => open(article, i + 2)} />
          ))}
        </View>
      </View>
    );
  };

  return (
    <Screen title={NEWS.title} onRefresh={() => client.invalidateQueries({ queryKey: NEWS_KEY })}>
      <LiveChip />
      <NewsHead symbol={symbol} />
      <NewsFilters symbol={symbol} onSymbol={setSymbol} tone={tone} onTone={setTone} />
      {reading?.ok && reading.stale ? <StaleNote /> : null}
      {body()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  live: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.6 },
  head: { gap: 8 },
  jp: { fontFamily: FONT.stamp, fontSize: 14, lineHeight: 20 },
  skeleton: { gap: 12 },
  feed: { gap: 16 },
});
