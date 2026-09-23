import { BASKET_SYMBOLS, BASKETS, basketMembersHeld, isBasketCoverable, type BasketSymbol } from "@agari/core/market";
import { isOk } from "@agari/core/schemas";
import type { LaneSet } from "@agari/core/types";
import { useAssetPrice, useLanes } from "@agari/markets/react";
import { useQueryClient } from "@tanstack/react-query";
import { StyleSheet, Text } from "react-native";
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
import { ErrorState, Pill, Screen, SectionHeader } from "~/components/kit";
import { TitleHero } from "~/features/short/PageParts";
import { TYPE, useTheme } from "~/theme";
import { BasketCard } from "./BasketCard";

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
 * `/baskets` — web's `features/baskets/BasketsIndex.tsx`: the five baskets in registry order, each read the app
 * already makes (lanes, price stream, PreStocks facts, the wallet's holdings, the week's marks).
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
    <Screen title={BASKETS_COPY.title} onRefresh={() => queryClient.invalidateQueries()}>
      <TitleHero
        eyebrow={BASKETS_COPY.eyebrow}
        aside={<Pill label={BASKETS_COPY.alwaysOpen} tone="profit" dot />}
        title={BASKETS_COPY.title}
        jp={BASKETS_COPY.headingJp}
        lead={BASKETS_COPY.intro}
      />
      <SectionHeader index="01" title={BASKETS_COPY.title} />
      {lanes && !lanes.ok ? <ErrorState diagnosis={lanes.error} /> : null}
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
      <Text style={[TYPE.caption, styles.foot, { color: color.inkMuted }]}>{BASKETS_COPY.foot}</Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  foot: { marginTop: 8 },
});
