import { BASKET_SYMBOLS, BASKETS, basketMembersHeld, isBasketCoverable, type BasketSymbol } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { LaneSet } from "@agari/core/types";
import { useAssetPrice, useLanes } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { StyleSheet, Text, View } from "react-native";
import { heldSymbols, tradingBasketWindow } from "@/features/baskets/basket-window";
import { BASKETS_COPY } from "@/features/baskets/copy";
import { basketLine, lineNumbers, useDeskMarks, type DeskMarks } from "@/features/desk/useDeskMarks";
import { useHoldings } from "@/features/hedge/useHoldings";
import { basisRaw, feedRawToOracleRaw } from "@/features/markets/hero/units";
import { useTopOfBook } from "@/features/markets/hero/useTopOfBook";
import { useChainNowMs } from "@/features/markets/useChainNow";
import { useVenue } from "@/features/markets/useVenue";
import { usePreIpoFactsAll, type PreIpoFactsView } from "@/features/ticker-hub/usePreIpoFacts";
import { useWalletSession } from "@/lib/wallet-session";
import { ExplorePage } from "~/features/explore/ExplorePage";
import { SectionHeader } from "~/features/explore/SectionHeader";
import { FONT, useTheme } from "~/theme";
import { BasketCard } from "./BasketCard";
import { LiveStatus } from "./DeskKit";

interface LiveCardProps {
  symbol: BasketSymbol;
  laneSet: LaneSet | null;
  nowMs: number;
  facts: PreIpoFactsView | null;
  held: ReadonlySet<string> | null;
  marks: DeskMarks | null;
}

/** web's `LiveBasketCard`: the index from the price stream (else the facts' index), its Window's book, its facts. */
function LiveBasketCard({ symbol, laneSet, nowMs, facts, held, marks }: LiveCardProps) {
  const basket = BASKETS[symbol];
  const price = useAssetPrice(symbol);
  const window = tradingBasketWindow(laneSet, symbol, nowMs);
  const { upCents, downCents, hydrating } = useTopOfBook(window);
  const live = price?.ok && price.value ? feedRawToOracleRaw(basisRaw(price.value), price.value.decimals) : null;
  return (
    <BasketCard
      basket={basket}
      indexRaw={live ?? facts?.indexE8 ?? null}
      move={facts?.move ?? null}
      window={window}
      book={window && !hydrating ? { upCents, downCents } : null}
      nowMs={nowMs}
      heldCount={held ? basketMembersHeld(basket, held).length : null}
      coverable={held ? isBasketCoverable(basket, held) : false}
      line={lineNumbers(basketLine(marks, symbol))}
    />
  );
}

/**
 * `/baskets` — web's `features/baskets/BasketsIndex.tsx` in the news-page frame at 402 px: the "PRE-IPO · 24/7"
 * line with its live chip, the Sora title, the Japanese line, the intro, "01 · Baskets", the five cards in registry
 * order, the mono foot. Every read is one the app already makes.
 */
export function BasketsScreen() {
  const { color } = useTheme();
  const queryClient = useQueryClient();
  const venue = useVenue();
  const lanes = useLanes(venue.venueId);
  const nowMs = useChainNowMs();
  const { address } = useWalletSession();
  const holdings = useHoldings(address);
  const facts = usePreIpoFactsAll(true);
  const marks = useDeskMarks();
  const laneSet = lanes && isOk(lanes) ? lanes.value : null;
  const held = holdings?.ok ? heldSymbols(holdings.value) : null;

  return (
    <ExplorePage title={BASKETS_COPY.title} onRefresh={() => queryClient.invalidateQueries()}>
      <View style={styles.page}>
        <View style={styles.live}>
          <Text style={[styles.liveLabel, { color: color.inkMuted }]}>{BASKETS_COPY.eyebrow}</Text>
          <View style={styles.liveChip}>
            <LiveStatus>{BASKETS_COPY.alwaysOpen}</LiveStatus>
          </View>
        </View>
        <Text style={[styles.title, { color: color.ink }]} accessibilityRole="header">
          {BASKETS_COPY.title}
        </Text>
        <Text style={[styles.jp, { color: color.inkMuted }]}>{BASKETS_COPY.headingJp}</Text>
        <Text style={[styles.intro, { color: color.inkSecondary }]}>{BASKETS_COPY.intro}</Text>
        <View accessibilityLabel={BASKETS_COPY.title}>
          <SectionHeader index="01" title={BASKETS_COPY.title} style={styles.sectionHead} />
          <View style={styles.grid}>
            {BASKET_SYMBOLS.map((symbol) => (
              <LiveBasketCard
                key={symbol}
                symbol={symbol}
                laneSet={laneSet}
                nowMs={nowMs}
                facts={facts?.ok ? (facts.value[symbol] ?? null) : null}
                held={held}
                marks={marks}
              />
            ))}
          </View>
        </View>
        <Text style={[styles.foot, { color: color.inkMuted }]}>{BASKETS_COPY.foot}</Text>
      </View>
    </ExplorePage>
  );
}

const styles = StyleSheet.create({
  page: { paddingTop: 48, paddingBottom: 96 },
  live: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 28, marginBottom: 12 },
  liveLabel: { fontFamily: FONT.dataRegular, fontSize: 10, lineHeight: 16, letterSpacing: 2.2, textTransform: "uppercase" },
  liveChip: { marginLeft: 4 },
  title: { fontFamily: FONT.headingHeavy, fontSize: 36, lineHeight: 39.6, letterSpacing: -0.9 },
  jp: { marginTop: 14, fontFamily: FONT.stamp, fontSize: 16, lineHeight: 24, letterSpacing: 0.6 },
  intro: { marginTop: 8, fontFamily: FONT.body, fontSize: 14, lineHeight: 21.7 },
  sectionHead: { marginTop: 48 },
  grid: { marginTop: 24, gap: 16 },
  foot: { marginTop: 24, fontFamily: FONT.dataRegular, fontSize: 9, lineHeight: 14.4, letterSpacing: 0.36 },
});
