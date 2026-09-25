import { basketOf, isTokenOnlyKind, TICKERS, type TickerSymbol } from "@agari/core/market";
import { keys } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { ACTIVITY } from "@/features/activity/copy";
import { useMoneyUnits, useTickerFeed } from "@/features/activity/useActivity";
import { useVenue } from "@/features/markets/useVenue";
import { NEWS } from "@/features/news/copy";
import { TICKER_HUB } from "@/features/ticker-hub/copy";
import { pythIndexRowOf, usePythIndex } from "@/features/ticker-hub/usePythIndex";
import { useTickerNews } from "@/features/ticker-hub/useTickerNews";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { ActivityList } from "~/features/activity/ActivityList";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { SectionHeader } from "~/features/explore/SectionHeader";
import { WireRow } from "~/features/news/NewsWire";
import { FONT, useTheme } from "~/theme";
import { BasketHub } from "./BasketHub";
import { LiveStatus, SessionChip } from "./HubParts";
import { NameFacts } from "./NameFacts";

/**
 * `/tickers/[SYMBOL]` — web's `TickerHubScreen` on a phone, in /news's frame: the kind and the session (or "Trading
 * 24/7"), the mark and the name with its cashtag, the Japanese line and the intro, the figure bar (`NameFacts`, or
 * `BasketHub` for a basket), then 01 Calls, 02 Headlines and 03 Board. A basket drops the wire and the board and
 * numbers its calls 03.
 */
export function TickerHubScreen({ symbol }: { symbol: TickerSymbol }) {
  const { color } = useTheme();
  const queryClient = useQueryClient();
  const ticker = TICKERS[symbol];
  const basket = basketOf(symbol);
  const preIpo = ticker.kind === "preIpo";
  const units = useMoneyUnits();
  const feed = useTickerFeed(symbol);
  const news = useTickerNews(basket ? null : symbol);
  const index = pythIndexRowOf(usePythIndex(preIpo && ticker.pythIndexFeedId !== null), symbol);
  const venue = useVenue();
  const articles = news?.ok ? news.value : null;

  const intro = basket
    ? TICKER_HUB.basket.intro(ticker.name, basket.members.map((m) => TICKERS[m.symbol].name).join(", "))
    : preIpo
      ? index
        ? TICKER_HUB.preIpo.introBoth(ticker.name)
        : TICKER_HUB.preIpo.intro(ticker.name)
      : TICKER_HUB.intro(ticker.name);
  const feedIndex = basket ? "03" : TICKER_HUB.feed.number;
  const quiet = [styles.quiet, { color: color.inkDisabled }];

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["agari", "social", "ticker", symbol] }),
      queryClient.invalidateQueries({ queryKey: ["agari", "news", symbol] }),
      queryClient.invalidateQueries({ queryKey: ["agari", "prestocks"] }),
      queryClient.invalidateQueries({ queryKey: keys.lanes(venue.venueId) }),
    ]);

  return (
    <ExplorePage title={TICKER_HUB.title(symbol, ticker.name)} onRefresh={refresh}>
      <View style={styles.page}>
        <View style={styles.live}>
          <Text style={[styles.liveLabel, { color: color.inkMuted }]}>{TICKER_HUB.eyebrow(ticker.kind)}</Text>
          {isTokenOnlyKind(ticker.kind) ? <LiveStatus label={TICKER_HUB.alwaysOpen} /> : <SessionChip />}
        </View>
        <View style={styles.titleRow}>
          <AssetDisc asset={symbol} size={40} />
          <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
            {ticker.name} <Text style={{ color: color.accent }}>${symbol}</Text>
          </Text>
        </View>
        <Text style={[styles.jp, { color: color.inkMuted }]}>{TICKER_HUB.headingJp}</Text>
        <Text style={[styles.intro, { color: color.inkSecondary }]}>{intro}</Text>

        {basket ? <BasketHub basket={basket} /> : <NameFacts symbol={symbol} preIpo={preIpo} index={index} />}

        <SectionHeader index={feedIndex} title={TICKER_HUB.feed.title} desc={TICKER_HUB.feed.desc} style={styles.head} />
        <ActivityList feed={feed.feed} failed={feed.failed} units={units} showWho empty={ACTIVITY.empty.ticker} limit={20} />

        {basket ? null : (
          <>
            <SectionHeader index={TICKER_HUB.news.number} title={TICKER_HUB.news.title} desc={TICKER_HUB.news.desc} eyebrow={TICKER_HUB.news.credit} style={styles.head} />
            {articles === null ? (
              <Text style={quiet} accessibilityRole={news === null ? "progressbar" : "text"}>
                {news === null ? ACTIVITY.loading : NEWS.quiet}
              </Text>
            ) : articles.length === 0 ? (
              <Text style={quiet}>{NEWS.quiet}</Text>
            ) : (
              <View style={styles.wire}>
                {articles.slice(0, 8).map((article, i) => (
                  <WireRow key={article.url} article={article} index={i + 1} />
                ))}
              </View>
            )}

            <SectionHeader index={TICKER_HUB.board.number} title={TICKER_HUB.board.title} desc={TICKER_HUB.board.desc} style={[styles.head, styles.headGap]} />
            <Text style={[quiet, styles.pending]}>
              {TICKER_HUB.board.pending}{" "}
              <Text style={{ color: color.accent }} accessibilityRole="link" onPress={() => router.push("/leaderboard")}>
                {TICKER_HUB.board.link}
              </Text>
            </Text>
          </>
        )}
      </View>
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 96 },
  live: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 14, marginBottom: 12 },
  liveLabel: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2.2, textTransform: "uppercase" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 8 },
  title: { flex: 1, fontFamily: FONT.headingHeavy, fontSize: 36, lineHeight: 39.6, letterSpacing: -0.9 },
  jp: { marginTop: 14, marginBottom: 8, fontFamily: FONT.stamp, fontSize: 15, lineHeight: 24, letterSpacing: 0.6 },
  intro: { fontFamily: FONT.body, fontSize: 14, lineHeight: 21.7 },
  head: { marginTop: 48 },
  headGap: { marginBottom: 24 },
  wire: { marginTop: 24 },
  quiet: { marginTop: 64, fontFamily: FONT.dataRegular, fontSize: 12, lineHeight: 19.2 },
  pending: { marginTop: 0, lineHeight: 20.4 },
});
