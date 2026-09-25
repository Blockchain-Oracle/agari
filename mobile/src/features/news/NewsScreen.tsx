import type { TickerSymbol } from "@agari/core/market";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { useAnimatedStyle, useReducedMotion, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { NEWS } from "@/features/news/copy";
import type { Article } from "@/features/news/protocol";
import { NEWS_KEY, useNews } from "@/features/news/useNews";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { FONT, useTheme } from "~/theme";
import { LeadStory, NewsSkeleton, Rule, WireRow } from "./NewsWire";

/** web NewsScreen.tsx `.news-live`: the pulsing vermilion dot and "Updated live". */
function Live() {
  const { color } = useTheme();
  const reduce = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (!reduce) pulse.value = withRepeat(withTiming(0.5, { duration: 1000 }), -1, true);
  }, [reduce, pulse]);
  const fade = useAnimatedStyle(() => ({ opacity: pulse.value }));
  return (
    <View style={styles.live}>
      <Animated.View style={[styles.liveDot, { backgroundColor: color.accent, shadowColor: color.accent }, fade]} />
      <Text style={[styles.liveLabel, { color: color.inkMuted }]}>{NEWS.live}</Text>
    </View>
  );
}

/** web NewsHead.tsx: "Market News" (or the ticker's), the Japanese line, the intro with the Finnhub credit. */
function NewsHead({ symbol }: { symbol: TickerSymbol | null }) {
  const { color } = useTheme();
  return (
    <>
      <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
        {symbol ?? NEWS.heading} <Text style={{ color: color.accent }}>{NEWS.headingAccent}</Text>
      </Text>
      <Text style={[styles.jp, { color: color.inkMuted }]}>{NEWS.headingJp}</Text>
      <Text style={[styles.intro, { color: color.inkSecondary }]}>{NEWS.intro}</Text>
    </>
  );
}

/** web NewsFeed.tsx: skeleton, the quiet line (no stories or no read), or the lead, the rule and the wire. */
function NewsFeed({ symbol }: { symbol: TickerSymbol | null }) {
  const { color } = useTheme();
  const reading = useNews(symbol);
  if (reading === null) return <View style={styles.feed}><NewsSkeleton /></View>;
  const articles = reading.ok ? reading.value : [];
  if (articles.length === 0) return <Text style={[styles.quiet, { color: color.inkDisabled }]}>{NEWS.quiet}</Text>;
  const [lead, ...rest] = articles as [Article, ...Article[]];
  return (
    <View style={styles.feed}>
      <LeadStory article={lead} />
      <Rule />
      {rest.map((article, i) => (
        <WireRow key={article.url} article={article} index={i + 2} />
      ))}
    </View>
  );
}

/** `/news` — web features/news/NewsScreen.tsx on a phone; `?symbol=` narrows the head and the wire. */
export function NewsScreen({ symbol }: { symbol: TickerSymbol | null }) {
  const client = useQueryClient();
  return (
    <ExplorePage title={NEWS.title} onRefresh={() => client.invalidateQueries({ queryKey: NEWS_KEY })}>
      <View style={styles.page}>
        <Live />
        <NewsHead symbol={symbol} />
        <NewsFeed symbol={symbol} />
      </View>
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 96 },
  live: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, shadowOpacity: 1, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
  liveLabel: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2.2, textTransform: "uppercase" },
  title: { fontFamily: FONT.headingHeavy, fontSize: 36, lineHeight: 39.6, letterSpacing: -0.9, marginBottom: 8 },
  jp: { fontFamily: FONT.stamp, fontSize: 16, lineHeight: 24, letterSpacing: 0.6, marginTop: 14, marginBottom: 8 },
  intro: { fontFamily: FONT.body, fontSize: 14, lineHeight: 21.7 },
  feed: { marginTop: 48 },
  quiet: { marginTop: 64, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 18 },
});
