import { basketOf, isTokenOnlyKind, TICKERS, type TickerSymbol } from "@agari/core/market";
import { isEnterable, phase } from "@agari/core/lifecycle";
import type { Lane, LaneSet } from "@agari/core/types";
import { keys, useLanes } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { ACTIVITY } from "@/features/activity/copy";
import { useMoneyUnits, useTickerFeed } from "@/features/activity/useActivity";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { NEWS } from "@/features/news/copy";
import { TAKES } from "@/features/takes/copy";
import { useTakes } from "@/features/takes/useTakes";
import { TICKER_HUB } from "@/features/ticker-hub/copy";
import { pythIndexRowOf, usePythIndex } from "@/features/ticker-hub/usePythIndex";
import { useTickerNews } from "@/features/ticker-hub/useTickerNews";
import { Button, Screen, SectionHeader } from "~/components/kit";
import { AssetDisc } from "~/components/marks/AssetDisc";
import { DropBellToggle, DropBellWatcher } from "~/features/hedge/DropBell";
import { LiveHedgeCard } from "~/features/hedge/LiveHedgeCard";
import { ActivityList } from "~/features/social/ActivityList";
import { TakeComposerSheet } from "~/features/takes/TakeComposerSheet";
import { FONT, TYPE, useTheme } from "~/theme";
import { BasketHub } from "./BasketHub";
import { Headlines } from "./Headlines";
import { Chip, LinkButton, SessionChip } from "./HubParts";
import { NameFacts } from "./NameFacts";

/**
 * Only this ticker's Windows, so a take posted from its hub is a call on it. The composer picks by cadence, and a stock
 * lists the same cadence on its stock lane and its 24/7 token lane: one lane per cadence is kept, the one with a Window
 * taking entries now (the token lane out of hours), so the horizon row never offers a cadence twice.
 */
function onlyTicker(laneSet: LaneSet | null, symbol: TickerSymbol, nowMs: number): LaneSet | null {
  if (!laneSet) return null;
  const live = (lane: Lane) => nowMs > 0 && lane.markets.some((market) => isEnterable(phase(market, nowMs)));
  const byCadence = new Map<number, Lane>();
  for (const lane of laneSet.lanes) {
    const own = { ...lane, markets: lane.markets.filter((market) => market.asset === symbol) };
    if (own.markets.length === 0) continue;
    const held = byCadence.get(own.intervalSec);
    if (!held || (!live(held) && live(own))) byCadence.set(own.intervalSec, own);
  }
  return { ...laneSet, lanes: [...byCadence.values()].sort((a, b) => a.intervalSec - b.intervalSec) };
}

/**
 * `/tickers/[SYMBOL]` — web's `TickerHubScreen` (features/ticker-hub/TickerHubScreen.tsx): the header (spot, session,
 * next report), the ticker's Room, the calls feed with `$SYM` takes, the headlines and the board pointer. A basket takes
 * the same frame with `BasketHub`. The app adds, from web's own hooks, the cover card for this company and the take
 * composer scoped to its Windows, so the hub is where a holder insures and a trader speaks.
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
  const lanes = useLanes(venue.venueId);
  const nowMs = useChainNowMs();
  const takes = useTakes(true, symbol);
  const [composing, setComposing] = useState(false);
  const laneSet = lanes?.ok ? lanes.value : null;
  // Re-picked every 15 s: often enough to follow a Window opening, not once a second.
  const laneTick = Math.floor(nowMs / 15_000);
  const ownLanes = useMemo(() => onlyTicker(laneSet, symbol, laneTick * 15_000), [laneSet, symbol, laneTick]);
  const articles = news?.ok ? news.value : null;

  const intro = basket
    ? TICKER_HUB.basket.intro(ticker.name, basket.members.map((m) => TICKERS[m.symbol].name).join(", "))
    : preIpo
      ? index
        ? TICKER_HUB.preIpo.introBoth(ticker.name)
        : TICKER_HUB.preIpo.intro(ticker.name)
      : TICKER_HUB.intro(ticker.name);
  const feedIndex = basket ? "03" : TICKER_HUB.feed.number;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["agari", "social", "ticker", symbol] }),
      queryClient.invalidateQueries({ queryKey: ["agari", "news", symbol] }),
      queryClient.invalidateQueries({ queryKey: ["agari", "prestocks"] }),
      queryClient.invalidateQueries({ queryKey: keys.lanes(venue.venueId) }),
    ]);

  return (
    <Screen title={`$${symbol}`} onRefresh={refresh}>
      <DropBellWatcher />
      <View style={styles.head}>
        <View style={styles.eyebrowRow}>
          <Text style={[styles.eyebrow, { color: color.accent }]}>{TICKER_HUB.eyebrow(ticker.kind).toUpperCase()}</Text>
          {isTokenOnlyKind(ticker.kind) ? <Chip dot={color.profit} word={TICKER_HUB.alwaysOpen} /> : <SessionChip />}
        </View>
        <View style={styles.titleRow}>
          <AssetDisc asset={symbol} size={44} />
          <Text style={[TYPE.headline, styles.title, { color: color.ink }]} accessibilityRole="header">
            {ticker.name} <Text style={{ color: color.accent }}>${symbol}</Text>
          </Text>
        </View>
        <Text style={[styles.jp, { color: color.inkMuted }]}>{TICKER_HUB.headingJp}</Text>
        <Text style={[TYPE.body, { color: color.inkSecondary }]}>{intro}</Text>
      </View>

      {basket ? <BasketHub basket={basket} /> : <NameFacts symbol={symbol} preIpo={preIpo} index={index} />}

      <Button
        label={`Ask Sensei about $${symbol}`}
        variant="outline"
        size="sm"
        icon={{ ios: "bubble.left.and.bubble.right.fill", android: "forum" }}
        onPress={() => router.push({ pathname: "/sensei", params: { asset: symbol } })}
      />

      {!basket ? (
        <View style={styles.cover}>
          <LiveHedgeCard laneSet={laneSet} nowMs={nowMs} only={symbol} />
          <DropBellToggle asset={symbol} />
        </View>
      ) : null}

      <SectionHeader index={feedIndex} title={TICKER_HUB.feed.title} desc={TICKER_HUB.feed.desc} />
      <Button
        label={TAKES.postAria}
        variant="secondary"
        size="sm"
        icon={{ ios: "square.and.pencil", android: "edit_square" }}
        onPress={() => setComposing(true)}
      />
      <ActivityList feed={feed.feed} failed={feed.failed} units={units} showWho empty={ACTIVITY.empty.ticker} limit={20} />

      {!basket ? (
        <>
          <SectionHeader index={TICKER_HUB.news.number} title={TICKER_HUB.news.title} desc={TICKER_HUB.news.desc} aside={TICKER_HUB.news.credit} />
          {articles === null || articles.length === 0 ? (
            <Text style={[TYPE.body, { color: color.inkSecondary }]} accessibilityRole={news === null ? "progressbar" : undefined}>
              {news === null ? ACTIVITY.loading : NEWS.quiet}
            </Text>
          ) : (
            <Headlines articles={articles.slice(0, 8)} />
          )}

          <SectionHeader index={TICKER_HUB.board.number} title={TICKER_HUB.board.title} desc={TICKER_HUB.board.desc} />
          <Text style={[TYPE.body, { color: color.inkSecondary }]}>{TICKER_HUB.board.pending}</Text>
          <LinkButton label={TICKER_HUB.board.link} onPress={() => router.push("/leaderboard")} />
        </>
      ) : null}

      <TakeComposerSheet
        visible={composing}
        laneSet={ownLanes}
        nowMs={nowMs}
        configured={takes === null ? null : takes.configured}
        onClose={() => setComposing(false)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { gap: 10 },
  eyebrowRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10 },
  eyebrow: { fontFamily: FONT.data, fontSize: 10.5, letterSpacing: 1.8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  title: { flex: 1 },
  jp: { fontFamily: FONT.stamp, fontSize: 15, letterSpacing: 1 },
  cover: { gap: 10 },
});
