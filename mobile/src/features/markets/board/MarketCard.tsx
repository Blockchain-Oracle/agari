import { phase as phaseOf, type MarketPhase } from "@agari/core/lifecycle";
import { formatCadence, isTickerSymbol, TICKERS } from "@agari/core/market";
import type { EventMarket, MarketId, Side } from "@agari/core/types";
import { router } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { sidesInOrder, useBetAgainst } from "@/features/markets/bet-against";
import { useChartSeries } from "@/features/markets/hero/useChartSeries";
import { useTopOfBook } from "@/features/markets/hero/useTopOfBook";
import { assetPriceLine } from "@/features/markets/hero/units";
import { etWeekday, laneAssetLabel, laneCadenceLabel } from "@/features/markets/lanes/lane-view";
import { HERO_HEAD, LANE_CARD, LANE_STATE, MARKETS } from "@/lib/copy";
import { CLOSED } from "@/lib/copy-closed";
import { useWhen } from "@/lib/when";
import { haptic } from "~/components/kit";
import { MarketRoomSheet } from "~/features/room/MarketRoomSheet";
import { useTheme } from "~/theme";
import { lanesTokens } from "~/theme/web/markets-lanes";
import { card } from "./card-styles";
import { CardSpark } from "./CardSpark";
import { CardHead, Ramp, RoomStrip } from "./CardParts";
import { CardClock } from "./CardClock";
import { ListedCard } from "./ListedCard";

type When = ReturnType<typeof useWhen>;

export interface MarketCardProps {
  market: EventMarket;
  nowMs: number;
  selected?: boolean;
  /** Selects the Window (with a side from UP/DOWN). Absent: the ticket opens over the page, as web's drawer does on a phone. */
  onSelect?: (marketId: MarketId, side?: Side) => void;
  /** Opens this Window's Room. Absent: the card mounts the Room sheet itself. */
  onOpenRoom?: (market: EventMarket) => void;
}

/** Opens the ticket on a Window — web's selection on a phone, where the ticket is a drawer over the page. */
export function openTicket(marketId: MarketId, side?: Side): void {
  router.push({ pathname: "/ticket", params: side ? { m: marketId, dir: side } : { m: marketId } });
}

/** web MarketsScreen's `roomCallLabel`: the question the Room is about, and which Window that was. */
export function roomCallLabel(market: EventMarket): string {
  const cadence = formatCadence(market.intervalSec);
  if (market.openingPriceRaw === null) return `${market.asset} · ${cadence}`;
  return `${HERO_HEAD.holdsAbove(market.asset)} ${assetPriceLine(market.asset, market.openingPriceRaw)}? · ${cadence}`;
}

const price = (value: number | null, hydrating: boolean): string => (value === null ? (hydrating ? LANE_CARD.priceLoading : HERO_HEAD.noPrice) : `${value}¢`);

/** The strip once the Window takes no calls: Masayume's closing line, or the Gap's own locked and settled words. */
function closedStrip(market: EventMarket, current: MarketPhase, when: When): string {
  if (market.lane !== "gap") return LANE_CARD.closing;
  if (current === "pendingOpeningPrint") return LANE_STATE.gap.pendingOpen;
  if (current === "voided") return LANE_STATE.gap.settled.void;
  if (current === "settledUnclaimed" || current === "finalized") return market.winningOutcome === 1 ? LANE_STATE.gap.settled.down : LANE_STATE.gap.settled.up;
  return LANE_STATE.gap.locked(when(market.expirySec, { seconds: true }));
}

/**
 * One live Window in the rail — web's MarketCard + MarketCardView (Masayume's `Market624Card`): the head, the question
 * against the opening print with its strike dot, the price and its distance from the line, the spark, the odds strip
 * with the UP ramp, the two sides at the book's best asks (DOWN first while betting against), and the Room strip. The
 * card selects its Window; a side selects it with that side. A listed Regular or Gap Window is the pending card.
 */
export function MarketCard({ market, nowMs, selected = false, onSelect = openTicket, onOpenRoom }: MarketCardProps) {
  const { name } = useTheme();
  const t = lanesTokens(name);
  const when = useWhen();
  const betAgainst = useBetAgainst();
  const series = useChartSeries(market);
  const { upCents, downCents, hydrating } = useTopOfBook(market);
  const [roomOpen, setRoomOpen] = useState(false);
  const current = nowMs > 0 ? phaseOf(market, nowMs) : null;
  if (current === "upcoming" && market.lane !== "token") return <ListedCard market={market} selected={selected} onSelect={onSelect} />;

  const points = series?.ok ? series.value.points : [];
  const latestRaw = series?.ok ? (series.value.latest?.valueRaw ?? null) : null;
  const openingRaw = market.openingPriceRaw;
  const kind = market.lane === "token" && isTickerSymbol(market.asset) ? CLOSED.kind[TICKERS[market.asset].kind] : null;
  const asset = laneAssetLabel(market.asset, market.lane);
  const ask = market.lane === "gap" ? LANE_STATE.gap.opensAbove(asset, etWeekday(market.expirySec)) : HERO_HEAD.holdsAbove(asset);
  const closing = current !== null && current !== "trading";
  const above = openingRaw !== null && latestRaw !== null ? latestRaw >= openingRaw : null;
  const select = (side?: Side) => {
    haptic.tap();
    onSelect(market.marketId, side);
  };
  const openRoom = () => (onOpenRoom ? onOpenRoom(market) : setRoomOpen(true));

  return (
    <Pressable
      onPress={() => select()}
      accessibilityRole="button"
      accessibilityLabel={LANE_CARD.openTicket(asset)}
      accessibilityState={{ selected }}
      style={[card.article, { backgroundColor: t.cardBg, borderColor: t.cardBorder }]}
    >
      <CardHead asset={market.asset} ticker={asset} cadence={laneCadenceLabel(market.lane, market.intervalSec)} kind={kind} clockTone="live" clock={<CardClock market={market} nowMs={nowMs} current={current} />} />

      <View style={card.body}>
        <Text style={[card.question, { color: t.ink }]}>
          {ask}{" "}
          {openingRaw === null ? <Text style={[card.strikeLoading, { color: t.gray600 }]}>···</Text> : `${assetPriceLine(asset, openingRaw)}?`}
          {openingRaw !== null ? <View style={[card.strikeDot, { backgroundColor: t.vermilion }]} /> : null}
        </Text>

        <View style={card.pricebar}>
          <View style={card.px}>
            <Text style={[card.big, { color: t.ink }]}>{latestRaw === null ? HERO_HEAD.noPrice : assetPriceLine(asset, latestRaw)}</Text>
            {above !== null && openingRaw !== null && latestRaw !== null ? (
              <Text style={[card.chg, { color: above ? t.profit : t.loss }]}>
                {above ? "+" : "−"}
                {assetPriceLine(asset, above ? latestRaw - openingRaw : openingRaw - latestRaw, openingRaw)}
              </Text>
            ) : null}
          </View>
        </View>

        <CardSpark points={points} openingRaw={openingRaw} />

        <View style={[card.strip, { backgroundColor: t.stripBg, borderTopColor: t.stripRule }]}>
          {closing && current ? (
            <Text style={[card.stripText, { color: t.stripInk }]}>{closedStrip(market, current, when)}</Text>
          ) : (
            <>
              <Text style={[card.stripText, { color: t.stripInk }]}>{upCents !== null ? LANE_CARD.oddsLive : hydrating || downCents !== null ? LANE_CARD.oddsLoading : LANE_CARD.noQuotes}</Text>
              <Ramp word={HERO_HEAD.rampUp} cents={upCents} figure={price(upCents, hydrating)} />
            </>
          )}
        </View>
      </View>

      {closing ? null : (
        <View style={[card.foot, { borderTopColor: t.cardRule }]}>
          {sidesInOrder(betAgainst).map((option) => {
            const up = option === "up";
            return (
              <Pressable
                key={option}
                onPress={() => select(option)}
                accessibilityRole="button"
                accessibilityLabel={up ? HERO_HEAD.betUp : HERO_HEAD.betDown}
                style={({ pressed }) => [card.side, { backgroundColor: up ? t.upBg : t.downBg, borderColor: up ? t.upBorder : t.downBorder }, pressed && card.pressed]}
              >
                <Text style={[card.sideLabel, { color: up ? t.profit : t.loss }]}>{up ? MARKETS.up : MARKETS.down}</Text>
                <Text style={[card.sidePrice, { color: up ? t.profit : t.loss }]}>{price(up ? upCents : downCents, hydrating)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      <RoomStrip label={HERO_HEAD.room} hint={HERO_HEAD.roomQualifier} onPress={openRoom} />
      {onOpenRoom ? null : (
        <MarketRoomSheet
          visible={roomOpen}
          marketId={market.marketId}
          asset={market.asset}
          callLabel={roomCallLabel(market)}
          onClose={() => setRoomOpen(false)}
          onBet={() => {
            setRoomOpen(false);
            onSelect(market.marketId);
          }}
        />
      )}
    </Pressable>
  );
}
